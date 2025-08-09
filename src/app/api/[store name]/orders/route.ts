// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wooconnect';
let cachedClient: MongoClient | null = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function GET(req: NextRequest, { params }: { params: { 'store name': string } }) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const uid = session.user.id;
    const storeName = decodeURIComponent(params['store name']);
    const client = await getClient();
    const db = client.db('wooconnect');
    const stores = db.collection('stores');
    // Find the store for this user
    const store = await stores.findOne({ uid, name: storeName });
    if (!store) {
      return NextResponse.json({ message: 'Store not found.' }, { status: 404 });
    }
    
    console.log('Found store:', store.name, 'URL:', store.url);
    
    // Fetch orders from WooCommerce API
    const ordersUrl = store.url.replace(/\/$/, '') + '/wp-json/wc/v3/orders';
    const url = new URL(ordersUrl);
    url.searchParams.set('consumer_key', store.consumerKey);
    url.searchParams.set('consumer_secret', store.consumerSecret);
    url.searchParams.set('per_page', '20'); // limit for demo
    url.searchParams.set('status', 'any');
    
    console.log('Fetching orders from:', url.toString());
    
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'WooConnect/1.0' } });
    if (!res.ok) {
      console.error('WooCommerce API error:', res.status, res.statusText);
      return NextResponse.json({ message: 'Failed to fetch orders from WooCommerce.' }, { status: 400 });
    }
    const data = await res.json();
    
    console.log('Raw orders data:', data?.length || 0, 'orders received');
    // Map WooCommerce orders to frontend format
    const orders = Array.isArray(data) ? data.map((order: any) => ({
      id: order.id,
      date: order.date_created,
      customer: order.billing?.first_name + ' ' + order.billing?.last_name,
      total: parseFloat(order.total),
      status: order.status,
      items: Array.isArray(order.line_items)
        ? order.line_items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price || item.subtotal || 0),
          }))
        : [],
    })) : [];
    
    console.log('Processed orders:', orders.length);
    
    return NextResponse.json({ orders }, { status: 200 });
  } catch (err) {
    console.error('Fetch orders error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
