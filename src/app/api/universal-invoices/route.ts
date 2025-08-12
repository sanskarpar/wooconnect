import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

interface UniversalInvoice {
  id: string;
  universalNumber: string; // Universal invoice number across all stores
  storeInvoiceNumber: string; // Original store invoice number
  storeName: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;
  orderStatus?: string;
  paymentMethod?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ invoices: [] }, { status: 200 });
    }

    console.log(`Found ${userStores.length} stores for user`);

    // Fetch invoices from all stores
    const allInvoicesPromises = userStores.map(async (store: any) => {
      try {
        console.log(`Fetching invoices for store: ${store.name}`);
        
        // Fetch orders from WooCommerce API that can be treated as invoices
        const ordersUrl = store.url.replace(/\/$/, '') + '/wp-json/wc/v3/orders';
        const url = new URL(ordersUrl);
        url.searchParams.set('consumer_key', store.consumerKey);
        url.searchParams.set('consumer_secret', store.consumerSecret);
        url.searchParams.set('per_page', '50');
        url.searchParams.set('status', 'any');

        const res = await fetch(url.toString(), { 
          headers: { 'User-Agent': 'WooConnect/1.0' }
        });
        
        if (!res.ok) {
          console.error(`WooCommerce API error for ${store.name}:`, res.status, res.statusText);
          return [];
        }

        const orders = await res.json();
        console.log(`Fetched ${orders?.length || 0} orders from ${store.name}`);

        // Map orders to invoices with store information
        return Array.isArray(orders) ? orders.map((order: any) => {
          const createdDate = new Date(order.date_created);
          const dueDate = new Date(createdDate);
          dueDate.setDate(dueDate.getDate() + 30);

          let status: 'paid' | 'unpaid' | 'overdue' = 'unpaid';
          if (order.status === 'completed' || order.status === 'processing') {
            status = 'paid';
          } else if (order.status === 'pending' || order.status === 'on-hold') {
            const now = new Date();
            status = now > dueDate ? 'overdue' : 'unpaid';
          }

          return {
            id: `${store.name}-${order.id}`, // Unique ID combining store and order
            storeInvoiceNumber: `INV-${order.number || order.id}`,
            storeName: store.name,
            amount: parseFloat(order.total || 0),
            status,
            customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Guest Customer',
            customerEmail: order.billing?.email || '',
            createdAt: order.date_created,
            dueDate: dueDate.toISOString(),
            orderStatus: order.status,
            paymentMethod: order.payment_method_title || order.payment_method || '',
            billingAddress: {
              address_1: order.billing?.address_1 || '',
              address_2: order.billing?.address_2 || '',
              city: order.billing?.city || '',
              state: order.billing?.state || '',
              postcode: order.billing?.postcode || '',
              country: order.billing?.country || '',
            },
            items: Array.isArray(order.line_items)
              ? order.line_items.map((item: any) => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: parseFloat(item.price || item.subtotal || 0),
                }))
              : [],
          };
        }).filter((invoice: any) => 
          ['pending', 'on-hold', 'processing', 'completed', 'cancelled'].includes(invoice.orderStatus)
        ) : [];

      } catch (error) {
        console.error(`Error fetching invoices from ${store.name}:`, error);
        return [];
      }
    });

    // Wait for all stores to respond
    const allInvoicesArrays = await Promise.all(allInvoicesPromises);
    const wooCommerceInvoices = allInvoicesArrays.flat();

    // Also fetch manually created invoices from the invoices collection
    const invoicesCollection = db.collection('invoices');
    const manualInvoices = await invoicesCollection
      .find({ userId: uid })
      .toArray();

    // Convert manual invoices to the same format
    const formattedManualInvoices: UniversalInvoice[] = manualInvoices.map((invoice: any) => ({
      id: invoice.id,
      universalNumber: invoice.universalNumber, // Already assigned
      storeInvoiceNumber: invoice.storeInvoiceNumber,
      storeName: invoice.storeName,
      amount: invoice.amount,
      status: invoice.status,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      orderStatus: undefined, // Manual invoices don't have order status
      paymentMethod: invoice.paymentMethod || '', // Include payment method
      items: invoice.items || [],
      billingAddress: invoice.billingAddress || {},
    }));

    // Check if WooCommerce invoices already have universal numbers stored
    const wooInvoiceMappingCollection = db.collection('wooInvoiceMapping');
    
    // Get existing mappings for WooCommerce invoices
    const existingMappings = await wooInvoiceMappingCollection.find({ userId: uid }).toArray();
    const mappingMap = new Map(existingMappings.map(m => [`${m.storeName}-${m.storeInvoiceNumber}`, m.universalNumber]));
    
    // Separate invoices that already have universal numbers from those that don't
    const invoicesWithNumbers: UniversalInvoice[] = [];
    const invoicesNeedingNumbers: (Omit<UniversalInvoice, 'universalNumber'>)[] = [];
    
    wooCommerceInvoices.forEach(inv => {
      const key = `${inv.storeName}-${inv.storeInvoiceNumber}`;
      const existingUniversalNumber = mappingMap.get(key);
      
      if (existingUniversalNumber) {
        // Invoice already has a universal number - use it
        invoicesWithNumbers.push({
          ...inv,
          universalNumber: existingUniversalNumber
        });
      } else {
        // Invoice needs a new universal number
        invoicesNeedingNumbers.push(inv);
      }
    });

    // For invoices that need numbers, assign them using the centralized counter
    const processedNewInvoices: UniversalInvoice[] = [];
    if (invoicesNeedingNumbers.length > 0) {
      // Sort by creation date to assign numbers consistently
      invoicesNeedingNumbers.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Assign numbers one by one to ensure correct numbering
      const universalNumbersCollection = db.collection('universalNumbers');
      
      for (const inv of invoicesNeedingNumbers) {
        const year = new Date(inv.createdAt).getFullYear().toString();
        
        // Get and increment the counter
        const counterResult = await universalNumbersCollection.findOneAndUpdate(
          { year, userId: uid },
          { $inc: { lastNumber: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        
        const universalNumber = `${year}-${String(counterResult?.value?.lastNumber || 1).padStart(2, '0')}`;
        
        // Create the invoice with universal number
        const invoiceWithNumber: UniversalInvoice = {
          ...inv,
          universalNumber
        };
        
        processedNewInvoices.push(invoiceWithNumber);
        
        // Store the mapping permanently
        await wooInvoiceMappingCollection.insertOne({
          userId: uid,
          storeName: inv.storeName,
          storeInvoiceNumber: inv.storeInvoiceNumber,
          universalNumber,
          createdAt: new Date().toISOString()
        });
      }
    }
    
    // Combine all WooCommerce invoices
    const processedWooInvoices = [...invoicesWithNumbers, ...processedNewInvoices];

    // Combine all invoices
    const universalInvoices = [...formattedManualInvoices, ...processedWooInvoices];

    // Sort by creation date descending for display (newest first)
    universalInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`Processed ${universalInvoices.length} universal invoices`);

    return NextResponse.json({ invoices: universalInvoices }, { status: 200 });
  } catch (err) {
    console.error('Universal invoices fetch error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
