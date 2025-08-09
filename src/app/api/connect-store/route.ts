// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wooconnect';

let cachedClient: MongoClient | null = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// Helper to build WooCommerce REST API URL with authentication
function buildWooApiUrl(baseUrl: string, endpoint: string, consumerKey: string, consumerSecret: string) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = new URL(`${cleanBaseUrl}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.append('consumer_key', consumerKey);
  url.searchParams.append('consumer_secret', consumerSecret);
  // Only add per_page=1 for endpoints that support it
  if (endpoint === 'products' || endpoint === 'orders' || endpoint === 'customers') {
    url.searchParams.append('per_page', '1');
  }
  return url.toString();
}

// Helper to fetch count from WooCommerce API
async function fetchWooCount(baseUrl: string, endpoint: string, consumerKey: string, consumerSecret: string) {
  const apiUrl = buildWooApiUrl(baseUrl, endpoint, consumerKey, consumerSecret);

  try {
    const res = await fetch(apiUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'WooConnect/1.0'
      }
    });

    if (!res.ok) {
      console.error(`WooCommerce API error for ${endpoint}:`, res.status, res.statusText);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Try to get count from headers first
    const totalHeader = res.headers.get('x-wp-total');
    // For customers, always use pagination with role=all
    if (endpoint === 'customers') {
      console.log('Fetching customers with pagination and role=all...');
      let total = 0;
      let page = 1;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      while (page <= maxPages) {
        const pagedUrl = new URL(baseUrl.replace(/\/$/, '') + '/wp-json/wc/v3/customers');
        pagedUrl.searchParams.set('consumer_key', consumerKey);
        pagedUrl.searchParams.set('consumer_secret', consumerSecret);
        pagedUrl.searchParams.set('per_page', '100');
        pagedUrl.searchParams.set('page', page.toString());
        pagedUrl.searchParams.set('role', 'all'); // <-- Ensure all customers are fetched

        console.log(`Fetching customers page ${page}:`, pagedUrl.toString());

        // Implement timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        let pagedRes;
        try {
          pagedRes = await fetch(pagedUrl.toString(), { 
            headers: { 'User-Agent': 'WooConnect/1.0' },
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!pagedRes.ok) {
          console.error(`Error fetching customers page ${page}:`, pagedRes.status, pagedRes.statusText);
          break;
        }
        
        const pagedData = await pagedRes.json();
        console.log(`Page ${page} returned:`, Array.isArray(pagedData) ? pagedData.length : 'not an array', 'customers');
        
        if (!Array.isArray(pagedData) || pagedData.length === 0) {
          break;
        }
        
        total += pagedData.length;
        
        // If we got less than 100 results, we've reached the end
        if (pagedData.length < 100) {
          break;
        }
        
        page++;
      }
      
      console.log(`Total customers found:`, total);
      return total;
    }

    if (totalHeader) {
      const count = parseInt(totalHeader, 10);
      console.log(`${endpoint} count from header:`, count);
      return count;
    }

    // Fallback: get data and count array length for products/orders
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : 0;
    console.log(`${endpoint} count from data length:`, count);
    return count;

  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

// Helper to fetch revenue and invoice count from WooCommerce API
async function fetchWooRevenueAndInvoices(baseUrl: string, consumerKey: string, consumerSecret: string) {
  // Revenue: sum of total from all orders (status: completed/processing)
  // Invoices: count of orders with status 'pending' or 'on-hold' (as unpaid invoices)
  let revenue = 0;
  let invoices = 0;
  // Helper to get last 12 months labels in 'MMM YYYY' format
  function getLast12Months() {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
    }
    return months;
  }

  const revenueByMonth: Record<string, number> = {};
  let monthlyRevenue: { month: string, revenue: number }[] = [];
  try {
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    while (hasMore && page <= 20) { // limit to 2000 orders max
      const url = new URL(baseUrl.replace(/\/$/, '') + '/wp-json/wc/v3/orders');
      url.searchParams.set('consumer_key', consumerKey);
      url.searchParams.set('consumer_secret', consumerSecret);
      url.searchParams.set('per_page', perPage.toString());
      url.searchParams.set('page', page.toString());
      url.searchParams.set('status', 'any'); // get all statuses

      const res = await fetch(url.toString(), { headers: { 'User-Agent': 'WooConnect/1.0' } });
      if (!res.ok) break;
      const orders = await res.json();
      if (!Array.isArray(orders) || orders.length === 0) break;

      for (const order of orders) {
        if (order.status === 'completed' || order.status === 'processing') {
          revenue += parseFloat(order.total || 0);
          // Group by month
          if (order.date_created) {
            const d = new Date(order.date_created);
            const month = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            revenueByMonth[month] = (revenueByMonth[month] || 0) + parseFloat(order.total || 0);
          }
        }
        if (order.status === 'pending' || order.status === 'on-hold') {
          invoices += 1;
        }
      }
      if (orders.length < perPage) break;
      page++;
    }
    // Build monthlyRevenue for last 12 months, filling missing months with zeroes
    const last12Months = getLast12Months();
    monthlyRevenue = last12Months.map(month => ({ month, revenue: revenueByMonth[month] || 0 }));
  } catch (err) {
    console.error('Error fetching revenue/invoices:', err);
  }
  return { revenue, invoices, monthlyRevenue };
}

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await getClient();
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Fetch user's stores (including secrets for stats refresh)
    const userStores = await stores.find(
      { uid }
    ).toArray();

    // For each store, fetch fresh stats from WooCommerce
    const refreshedStores = await Promise.all(userStores.map(async store => {
      let stats = { products: 0, orders: 0, customers: 0 };
      let revenue = 0;
      let invoices = 0;
      let monthlyRevenue: { month: string, revenue: number }[] = [];
      let topProducts: { name: string, sales: number }[] = [];
      try {
        stats = {
          products: await fetchWooCount(store.url, 'products', store.consumerKey, store.consumerSecret),
          orders: await fetchWooCount(store.url, 'orders', store.consumerKey, store.consumerSecret),
          customers: await fetchWooCount(store.url, 'customers', store.consumerKey, store.consumerSecret),
        };
        // Fetch revenue and invoices
        const revInv = await fetchWooRevenueAndInvoices(store.url, store.consumerKey, store.consumerSecret);
        revenue = revInv.revenue;
        invoices = revInv.invoices;
        monthlyRevenue = revInv.monthlyRevenue || [];
        // Fetch top products
        // Get products and their sales
        const productsUrl = new URL(store.url.replace(/\/$/, '') + '/wp-json/wc/v3/products');
        productsUrl.searchParams.set('consumer_key', store.consumerKey);
        productsUrl.searchParams.set('consumer_secret', store.consumerSecret);
        productsUrl.searchParams.set('per_page', '10');
        productsUrl.searchParams.set('orderby', 'popularity');
        productsUrl.searchParams.set('order', 'desc');
        const productsRes = await fetch(productsUrl.toString(), { headers: { 'User-Agent': 'WooConnect/1.0' } });
        if (productsRes.ok) {
          const products = await productsRes.json();
          if (Array.isArray(products)) {
            topProducts = products.map((p: any) => ({ name: p.name, sales: p.total_sales ? parseInt(p.total_sales) : 0 })).slice(0, 5);
          }
        }
        // Optionally update stats in DB (uncomment if you want to persist latest stats)
        // await stores.updateOne({ _id: store._id }, { $set: { stats: { ...stats, revenue, invoices, monthlyRevenue, topProducts } } });
      } catch (err) {
        console.error(`Failed to refresh stats for store ${store._id}:`, err);
        stats = store.stats || stats;
        revenue = store.stats?.revenue || 0;
        invoices = store.stats?.invoices || 0;
        monthlyRevenue = store.stats?.monthlyRevenue || [];
        topProducts = store.stats?.topProducts || [];
      }
      return {
        ...store,
        stats: { ...stats, revenue, invoices, monthlyRevenue, topProducts },
        id: store._id.toString(),
        _id: undefined,
        consumerKey: undefined,
        consumerSecret: undefined,
      };
    }));

    return NextResponse.json(refreshedStores, { status: 200 });
  } catch (err) {
    console.error('Fetch stores error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Ensure NEXTAUTH_SECRET is set
    if (!process.env.NEXTAUTH_SECRET) {
      console.error('NEXTAUTH_SECRET is not set in environment variables.');
      return NextResponse.json(
        { message: 'Server configuration error. Please check environment variables.' },
        { status: 500 }
      );
    }
    
    // Ensure NEXTAUTH_URL is set
    if (!process.env.NEXTAUTH_URL) {
      console.error('NEXTAUTH_URL is not set in environment variables.');
      return NextResponse.json(
        { message: 'Server configuration error. Please check environment variables.' },
        { status: 500 }
      );
    }

    interface SessionUser {
      id: string;
      name?: string;
      email?: string;
      image?: string;
    }
    interface Session {
      user?: SessionUser;
      [key: string]: any;
    }
    
    // Use the new next-auth auth() helper for App Router
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      console.log('No session or user ID found');
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    // Ensure uid is the user's MongoDB _id string
    const uid = session.user.id;

    const body = await req.json();
    const { name, url, consumerKey, consumerSecret } = body;

    if (!name || !url || !consumerKey || !consumerSecret) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    // Validate URL format
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Fetch real stats from WooCommerce API
    let stats = { products: 0, orders: 0, customers: 0, revenue: 0, invoices: 0 };
    try {
      console.log('Fetching WooCommerce stats for:', normalizedUrl);
      
      // Test connection first with a simple products call
      const testUrl = buildWooApiUrl(normalizedUrl, 'products', consumerKey, consumerSecret);
      const testRes = await fetch(testUrl, { 
        method: 'GET',
        headers: { 'User-Agent': 'WooConnect/1.0' }
      });
      
      if (!testRes.ok) {
        throw new Error(`Cannot connect to WooCommerce API: ${testRes.status} ${testRes.statusText}`);
      }

      // Fetch all counts in parallel
      const [products, orders, customers, revInv] = await Promise.allSettled([
        fetchWooCount(normalizedUrl, 'products', consumerKey, consumerSecret),
        fetchWooCount(normalizedUrl, 'orders', consumerKey, consumerSecret),
        fetchWooCount(normalizedUrl, 'customers', consumerKey, consumerSecret),
        fetchWooRevenueAndInvoices(normalizedUrl, consumerKey, consumerSecret),
      ]);

      stats = {
        products: products.status === 'fulfilled' ? products.value : 0,
        orders: orders.status === 'fulfilled' ? orders.value : 0,
        customers: customers.status === 'fulfilled' ? customers.value : 0,
        revenue: revInv.status === 'fulfilled' ? revInv.value.revenue : 0,
        invoices: revInv.status === 'fulfilled' ? revInv.value.invoices : 0,
      };

      console.log('Fetched stats:', stats);

    } catch (wooErr) {
      console.error('Error fetching WooCommerce stats:', wooErr);
      return NextResponse.json({ 
        message: `Failed to connect to WooCommerce store: ${wooErr instanceof Error ? wooErr.message : 'Unknown error'}. Please verify your store URL and API credentials.` 
      }, { status: 400 });
    }

    const client = await getClient();
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Save store with uid (user's _id)
    const newStore = {
      uid, // user's _id as string
      name,
      url: normalizedUrl,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      stats,
      consumerKey,
      consumerSecret,
    };

    // Insert into stores collection
    const result = await stores.insertOne(newStore);

    // Return the store object (without secrets)
    const { consumerKey: _, consumerSecret: __, ...publicStore } = {
      ...newStore,
      id: result.insertedId.toString(),
    };
    return NextResponse.json(publicStore, { status: 200 });
  } catch (err) {
    console.error('Connect store error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

