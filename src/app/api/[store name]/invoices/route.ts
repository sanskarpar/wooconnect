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

    // Get all stores for this user to generate universal numbers
    const allStores = await stores.find({ uid }).toArray();
    
    // Fetch all invoices from all stores to generate consistent universal numbering
    const allInvoicesPromises = allStores.map(async (userStore: any) => {
      try {
        const storeOrdersUrl = userStore.url.replace(/\/$/, '') + '/wp-json/wc/v3/orders';
        const storeUrl = new URL(storeOrdersUrl);
        storeUrl.searchParams.set('consumer_key', userStore.consumerKey);
        storeUrl.searchParams.set('consumer_secret', userStore.consumerSecret);
        storeUrl.searchParams.set('per_page', '50');
        storeUrl.searchParams.set('status', 'any');

        const storeRes = await fetch(storeUrl.toString(), { 
          headers: { 'User-Agent': 'WooConnect/1.0' }
        });
        
        if (!storeRes.ok) {
          console.error(`WooCommerce API error for ${userStore.name}:`, storeRes.status, storeRes.statusText);
          return [];
        }

        const storeOrders = await storeRes.json();
        
        return Array.isArray(storeOrders) ? storeOrders.map((order: any) => ({
          ...order,
          storeName: userStore.name,
          storeId: userStore._id.toString()
        })).filter((order: any) => 
          ['pending', 'on-hold', 'processing', 'completed', 'cancelled'].includes(order.status)
        ) : [];

      } catch (error) {
        console.error(`Error fetching orders from ${userStore.name}:`, error);
        return [];
      }
    });

    const allOrdersArrays = await Promise.all(allInvoicesPromises);
    const allOrders = allOrdersArrays.flat();

    // Sort by creation date to assign universal numbers consistently
    allOrders.sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime());

    // Group orders by year and assign universal numbers
    const ordersByYear: Record<string, any[]> = {};
    allOrders.forEach(order => {
      const year = new Date(order.date_created).getFullYear().toString();
      if (!ordersByYear[year]) ordersByYear[year] = [];
      ordersByYear[year].push(order);
    });

    // Create universal number mapping
    const universalNumberMap: Record<string, string> = {};
    Object.entries(ordersByYear).forEach(([year, orders]) => {
      orders.forEach((order, idx) => {
        const orderKey = `${order.storeName}-${order.id}`;
        universalNumberMap[orderKey] = `${year}-${String(idx + 1).padStart(2, '0')}`;
      });
    });

    // Map WooCommerce orders to invoice format with universal numbers
    const invoices = Array.isArray(data) ? data.map((order: any) => {
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

      // Get universal number for this order
      const orderKey = `${storeName}-${order.id}`;
      const universalNumber = universalNumberMap[orderKey];

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
    }).filter((invoice: any) => 
      // Only include orders that make sense as invoices
      ['pending', 'on-hold', 'processing', 'completed', 'cancelled'].includes(invoice.orderStatus)
    ) : [];

    console.log('Processed invoices:', invoices.length);

    return NextResponse.json({ invoices }, { status: 200 });
  } catch (err) {
    console.error('Fetch invoices error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
