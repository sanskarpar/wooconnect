import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Get all connected stores for this user
    const userStores = await stores.find({ uid }).toArray();
    
    if (userStores.length === 0) {
      return NextResponse.json({ message: 'No stores found to sync.' }, { status: 200 });
    }

    console.log(`Starting sync for ${userStores.length} stores`);

    const universalInvoicesCollection = db.collection('universalInvoices');
    const wooInvoiceMappingCollection = db.collection('wooInvoiceMapping');
    const universalNumbersCollection = db.collection('universalNumbers');

    let totalSynced = 0;
    let totalUpdated = 0;

    // Get existing mappings to avoid duplicates
    const existingMappings = await wooInvoiceMappingCollection.find({ userId: uid }).toArray();
    const mappingMap = new Map(existingMappings.map((m: any) => [`${m.storeName}-${m.storeInvoiceNumber}`, m.universalNumber]));

    // Process each store
    for (const store of userStores) {
      console.log(`Syncing invoices for store: ${store.name}`);
      
      try {
        // Fetch orders from WooCommerce API
        const ordersUrl = store.url.replace(/\/$/, '') + '/wp-json/wc/v3/orders';
        const url = new URL(ordersUrl);
        url.searchParams.set('consumer_key', store.consumerKey);
        url.searchParams.set('consumer_secret', store.consumerSecret);
        url.searchParams.set('per_page', '100'); // Get more orders for sync
        url.searchParams.set('status', 'any');

        const res = await fetch(url.toString(), { 
          headers: { 'User-Agent': 'WooConnect/1.0' }
        });
        
        if (!res.ok) {
          console.error(`WooCommerce API error for ${store.name}:`, res.status, res.statusText);
          continue;
        }

        const orders = await res.json();
        console.log(`Fetched ${orders?.length || 0} orders from ${store.name}`);

        if (!Array.isArray(orders)) continue;

        // Filter orders that can be treated as invoices
        const filteredOrders = orders.filter((order: any) => 
          ['pending', 'on-hold', 'processing', 'completed', 'cancelled'].includes(order.status)
        );

        // Process each order
        for (const order of filteredOrders) {
          const storeInvoiceNumber = `INV-${order.number || order.id}`;
          const invoiceKey = `${store.name}-${storeInvoiceNumber}`;
          
          // Check if this invoice already exists in universalInvoices collection
          const existingInvoice = await universalInvoicesCollection.findOne({
            userId: uid,
            storeName: store.name,
            storeInvoiceNumber: storeInvoiceNumber,
            wooCommerceOrderId: order.id.toString()
          });

          const createdDate = new Date(order.date_created);
          const dueDate = new Date(createdDate);
          dueDate.setDate(dueDate.getDate() + 30);

          // Determine invoice status based on order status
          let status: 'paid' | 'unpaid' | 'overdue' = 'unpaid';
          if (order.status === 'completed' || order.status === 'processing') {
            status = 'paid';
          } else if (order.status === 'pending' || order.status === 'on-hold') {
            const now = new Date();
            status = now > dueDate ? 'overdue' : 'unpaid';
          }

          if (!existingInvoice) {
            // Get or assign universal number
            let universalNumber = mappingMap.get(invoiceKey);
            
            if (!universalNumber) {
              // Assign new universal number
              const year = new Date(order.date_created).getFullYear().toString();
              
              const counterResult = await universalNumbersCollection.findOneAndUpdate(
                { year, userId: uid },
                { $inc: { lastNumber: 1 } },
                { upsert: true, returnDocument: 'after' }
              );
              
              universalNumber = `${year}-${String(counterResult?.value?.lastNumber || 1).padStart(2, '0')}`;
              
              // Store the mapping
              await wooInvoiceMappingCollection.insertOne({
                userId: uid,
                storeName: store.name,
                storeInvoiceNumber,
                universalNumber,
                createdAt: new Date().toISOString()
              });
              
              mappingMap.set(invoiceKey, universalNumber);
            }

            // Create new invoice document
            const newInvoice = {
              userId: uid,
              universalNumber,
              storeInvoiceNumber,
              storeName: store.name,
              wooCommerceOrderId: order.id.toString(),
              amount: parseFloat(order.total || 0),
              status,
              customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Guest Customer',
              customerEmail: order.billing?.email || '',
              createdAt: order.date_created,
              dueDate: dueDate.toISOString(),
              orderStatus: order.status,
              paymentMethod: order.payment_method_title || order.payment_method || '',
              customerAddress: order.billing ? {
                address_1: order.billing.address_1 || '',
                address_2: order.billing.address_2 || '',
                city: order.billing.city || '',
                postcode: order.billing.postcode || '',
                country: order.billing.country || '',
                state: order.billing.state || '',
              } : {},
              items: Array.isArray(order.line_items)
                ? order.line_items.map((item: any) => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: parseFloat(item.price || item.subtotal || 0),
                  }))
                : [],
              source: 'woocommerce',
              savedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };

            await universalInvoicesCollection.insertOne(newInvoice);
            totalSynced++;
            console.log(`Saved new invoice ${universalNumber} from ${store.name}`);
          } else {
            // Update existing invoice if status or amount has changed
            const updateFields: any = {};
            let hasChanges = false;
            
            if (existingInvoice.status !== status) {
              updateFields.status = status;
              hasChanges = true;
            }
            if (existingInvoice.amount !== parseFloat(order.total || 0)) {
              updateFields.amount = parseFloat(order.total || 0);
              hasChanges = true;
            }
            if (existingInvoice.orderStatus !== order.status) {
              updateFields.orderStatus = order.status;
              hasChanges = true;
            }
            
            if (hasChanges) {
              updateFields.lastUpdated = new Date().toISOString();
              await universalInvoicesCollection.updateOne(
                { _id: existingInvoice._id },
                { $set: updateFields }
              );
              totalUpdated++;
              console.log(`Updated invoice ${existingInvoice.universalNumber} from ${store.name}`);
            }
          }
        }

      } catch (error) {
        console.error(`Error syncing invoices from ${store.name}:`, error);
        continue;
      }
    }

    console.log(`Sync completed: ${totalSynced} new invoices saved, ${totalUpdated} invoices updated`);

    return NextResponse.json({ 
      message: `Sync completed successfully. ${totalSynced} new invoices saved, ${totalUpdated} invoices updated.`,
      synced: totalSynced,
      updated: totalUpdated
    }, { status: 200 });

  } catch (err) {
    console.error('Sync invoices error:', err);
    return NextResponse.json({ message: 'Internal server error during sync.' }, { status: 500 });
  }
}
