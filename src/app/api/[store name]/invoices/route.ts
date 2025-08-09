// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// MongoDB URI and client handled in lib/mongodb
// ...existing code...

// ...existing code...

export async function GET(req: NextRequest, { params }: { params: { 'store name': string } }) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const storeName = decodeURIComponent(params['store name']);
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

    // Map WooCommerce orders to invoice format
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

      return {
        id: order.id.toString(),
        number: `INV-${order.number || order.id}`,
        amount: parseFloat(order.total || 0),
        status,
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Guest Customer',
        customerEmail: order.billing?.email || '',
        createdAt: order.date_created,
        dueDate: dueDate.toISOString(),
        orderStatus: order.status,
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
