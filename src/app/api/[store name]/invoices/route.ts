// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// MongoDB URI and client handled in lib/mongodb
// ...existing code...

// ...existing code...

export async function GET(req: NextRequest, { params }: { params: Promise<{ "store name": string }> }) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const resolvedParams = await params;
    const storeName = decodeURIComponent(resolvedParams["store name"]);
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Find the store for this user
    const store = await stores.findOne({ uid, name: storeName });
    if (!store) {
      return NextResponse.json({ message: 'Store not found.' }, { status: 404 });
    }

    console.log('Found store:', store.name, 'URL:', store.url);

    // Fetch orders from WooCommerce API that can be treated as invoices
    // We'll consider orders with status 'pending', 'on-hold', 'processing', or 'completed' as invoices
    const ordersUrl = store.url.replace(/\/$/, '') + '/wp-json/wc/v3/orders';
    const url = new URL(ordersUrl);
    url.searchParams.set('consumer_key', store.consumerKey);
    url.searchParams.set('consumer_secret', store.consumerSecret);
    url.searchParams.set('per_page', '50'); // Get more invoices
    url.searchParams.set('status', 'any');

    console.log('Fetching orders for invoices from:', url.toString());

    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'WooConnect/1.0' } });
    if (!res.ok) {
      console.error('WooCommerce API error:', res.status, res.statusText);
      return NextResponse.json({ message: 'Failed to fetch invoices from WooCommerce.' }, { status: 400 });
    }

    const data = await res.json();
    console.log('Raw orders data for invoices:', data?.length || 0, 'orders received');

    // Use the same universal numbering system as the dashboard
    // Check if WooCommerce invoices already have universal numbers stored
    const wooInvoiceMappingCollection = db.collection('wooInvoiceMapping');
    
    // Get existing mappings for WooCommerce invoices
    const existingMappings = await wooInvoiceMappingCollection.find({ userId: uid }).toArray();
    const mappingMap = new Map(existingMappings.map(m => [`${m.storeName}-${m.storeInvoiceNumber}`, m.universalNumber]));
    
    // Process invoices and assign universal numbers using the centralized system
    const processInvoiceUniversalNumber = async (order: any) => {
      const storeInvoiceNumber = `INV-${order.number || order.id}`;
      const key = `${storeName}-${storeInvoiceNumber}`;
      
      // Check if this invoice already has a universal number
      const existingUniversalNumber = mappingMap.get(key);
      
      if (existingUniversalNumber) {
        return existingUniversalNumber;
      }
      
      // If not, assign a new universal number using the centralized counter
      const year = new Date(order.date_created).getFullYear().toString();
      const universalNumbersCollection = db.collection('universalNumbers');
      
      // Get and increment the counter
      const counterResult = await universalNumbersCollection.findOneAndUpdate(
        { year, userId: uid },
        { $inc: { lastNumber: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      
      const universalNumber = `${year}-${String(counterResult?.value?.lastNumber || 1).padStart(2, '0')}`;
      
      // Store the mapping permanently
      await wooInvoiceMappingCollection.insertOne({
        userId: uid,
        storeName: storeName,
        storeInvoiceNumber,
        universalNumber,
        createdAt: new Date().toISOString()
      });
      
      return universalNumber;
    };

    // Map WooCommerce orders to invoice format with universal numbers
    const filteredOrders = Array.isArray(data) ? data.filter((order: any) => 
      // Only include orders that make sense as invoices
      ['pending', 'on-hold', 'processing', 'completed', 'cancelled'].includes(order.status)
    ) : [];

    const invoicesPromises = filteredOrders.map(async (order: any) => {
      const createdDate = new Date(order.date_created);
      const dueDate = new Date(createdDate);
      dueDate.setDate(dueDate.getDate() + 30); // Set due date 30 days from creation

      // Determine invoice status based on order status
      let status: 'paid' | 'unpaid' | 'overdue' = 'unpaid';
      if (order.status === 'completed' || order.status === 'processing') {
        status = 'paid';
      } else if (order.status === 'pending' || order.status === 'on-hold') {
        // Check if due date has passed
        const now = new Date();
        status = now > dueDate ? 'overdue' : 'unpaid';
      }

      // Get universal number for this order using the centralized system
      const universalNumber = await processInvoiceUniversalNumber(order);

      return {
        id: order.id.toString(),
        number: `INV-${order.number || order.id}`,
        universalNumber,
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
        } : undefined,
        items: Array.isArray(order.line_items)
          ? order.line_items.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: parseFloat(item.price || item.subtotal || 0),
            }))
          : [],
      };
    });

    // Wait for all invoice processing to complete
    const invoices = await Promise.all(invoicesPromises);

    console.log('Processed invoices:', invoices.length);

    return NextResponse.json({ invoices }, { status: 200 });
  } catch (err) {
    console.error('Fetch invoices error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
