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
    const allInvoices = allInvoicesArrays.flat();

    // Sort by creation date to assign universal numbers consistently
    allInvoices.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Assign universal invoice numbers

      // Group invoices by year

      type InvoiceWithoutUniversal = Omit<UniversalInvoice, 'universalNumber'>;
      const invoicesByYear: Record<string, InvoiceWithoutUniversal[]> = {};
      allInvoices.forEach(inv => {
        const year = new Date(inv.createdAt).getFullYear().toString();
        if (!invoicesByYear[year]) invoicesByYear[year] = [];
        invoicesByYear[year].push(inv);
      });

      // Assign numbers per year
      let universalInvoices: UniversalInvoice[] = [];
      Object.entries(invoicesByYear).forEach(([year, invoices]) => {
        invoices.forEach((invoice, idx) => {
          universalInvoices.push({
            ...invoice,
            universalNumber: `${year}-${String(idx + 1).padStart(2, '0')}` // e.g., 2025-01
          });
        });
      });

    // Sort by creation date descending for display (newest first)
    universalInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`Processed ${universalInvoices.length} universal invoices`);

    return NextResponse.json({ invoices: universalInvoices }, { status: 200 });
  } catch (err) {
    console.error('Universal invoices fetch error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
