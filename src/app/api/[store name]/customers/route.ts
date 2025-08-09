// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wooconnect';
let cachedClient: MongoClient | null = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// Helper to build WooCommerce customers API URL
function buildCustomersUrl(baseUrl: string, consumerKey: string, consumerSecret: string, page: number = 1) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = new URL(`${cleanBaseUrl}/wp-json/wc/v3/customers`);
  url.searchParams.set('consumer_key', consumerKey);
  url.searchParams.set('consumer_secret', consumerSecret);
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', page.toString());
  url.searchParams.set('role', 'all');
  return url.toString();
}

export async function GET(req: NextRequest) {
  try {
    // Extract store name from URL
    const urlParts = req.url.split('/');
    const storeName = decodeURIComponent(urlParts[urlParts.indexOf('api') + 1]);
    if (!storeName) {
      return NextResponse.json({ message: 'Missing store name.' }, { status: 400 });
    }

    // Get user's stores from DB
    const client = await getClient();
    const db = client.db('wooconnect');
    const stores = db.collection('stores');
    const store = await stores.findOne({ name: storeName });
    if (!store) {
      return NextResponse.json({ message: 'Store not found.' }, { status: 404 });
    }
    const { url, consumerKey, consumerSecret } = store;
    if (!url || !consumerKey || !consumerSecret) {
      return NextResponse.json({ message: 'Missing store credentials.' }, { status: 400 });
    }

    // Fetch all customers with pagination
    let allCustomers: any[] = [];
    let page = 1;
    const maxPages = 50;
    while (page <= maxPages) {
      const apiUrl = buildCustomersUrl(url, consumerKey, consumerSecret, page);
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'WooConnect/1.0' } });
      if (!res.ok) break;
      const customers = await res.json();
      if (!Array.isArray(customers) || customers.length === 0) break;
      allCustomers = allCustomers.concat(customers);
      if (customers.length < 100) break;
      page++;
    }

    // Fetch all orders to find guest customers
    let allOrders: any[] = [];
    page = 1;
    while (page <= maxPages) {
      const ordersUrl = `${url.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}&per_page=100&page=${page}`;
      const res = await fetch(ordersUrl, { headers: { 'User-Agent': 'WooConnect/1.0' } });
      if (!res.ok) break;
      const orders = await res.json();
      if (!Array.isArray(orders) || orders.length === 0) break;
      allOrders = allOrders.concat(orders);
      if (orders.length < 100) break;
      page++;
    }

    // Extract guest customers from orders (customer_id === 0)
    const guestMap = new Map();
    for (const order of allOrders) {
      if (order.customer_id === 0) {
        // Use email+name+phone as key to avoid duplicates
        const key = `${order.billing.email || ''}|${order.billing.first_name || ''}|${order.billing.last_name || ''}|${order.billing.phone || ''}`;
        if (!guestMap.has(key)) {
          guestMap.set(key, {
            id: `guest-${order.id}`,
            first_name: order.billing.first_name || 'Guest',
            last_name: order.billing.last_name || '',
            email: order.billing.email || '',
            username: '',
            date_created: order.date_created,
            orders_count: 1,
            total_spent: order.total,
            avatar_url: '',
            billing: order.billing || {},
          });
        } else {
          // Update orders_count and total_spent
          const guest = guestMap.get(key);
          guest.orders_count = (guest.orders_count || 1) + 1;
          guest.total_spent = (parseFloat(guest.total_spent || '0') + parseFloat(order.total || '0')).toString();
          // Use earliest date_created
          if (new Date(order.date_created) < new Date(guest.date_created)) {
            guest.date_created = order.date_created;
          }
        }
      }
    }

    // Merge guest customers with registered customers
    const mergedCustomers = [
      ...allCustomers,
      ...Array.from(guestMap.values()),
    ];

    return NextResponse.json(mergedCustomers, { status: 200 });
  } catch (err) {
    console.error('Fetch customers error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
