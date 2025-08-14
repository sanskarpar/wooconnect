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
  billingAddress?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
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
    
    // First, get all saved invoices from the universalInvoices collection
    const universalInvoicesCollection = db.collection('universalInvoices');
    const savedInvoices = await universalInvoicesCollection
      .find({ userId: uid })
      .sort({ createdAt: -1 }) // Sort by creation date descending
      .toArray();

    console.log(`Found ${savedInvoices.length} saved invoices`);

    // Convert saved invoices to the expected format
    const formattedSavedInvoices: UniversalInvoice[] = savedInvoices.map((invoice: any) => ({
      id: invoice.wooCommerceOrderId || invoice._id.toString(),
      universalNumber: invoice.universalNumber,
      storeInvoiceNumber: invoice.storeInvoiceNumber,
      storeName: invoice.storeName,
      amount: invoice.amount,
      status: invoice.status,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      orderStatus: invoice.orderStatus,
      paymentMethod: invoice.paymentMethod,
      items: invoice.items || [],
      billingAddress: invoice.customerAddress || {},
    }));

    // Sort by creation date descending for display (newest first)
    formattedSavedInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`Returning ${formattedSavedInvoices.length} total invoices`);

    return NextResponse.json({ invoices: formattedSavedInvoices }, { status: 200 });
  } catch (err) {
    console.error('Universal invoices fetch error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const invoiceData = await req.json();
    
    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    // Generate universal invoice number
    const year = new Date(invoiceData.dueDate).getFullYear().toString();
    const universalNumbersCollection = db.collection('universalNumbers');
    
    const counterResult = await universalNumbersCollection.findOneAndUpdate(
      { year, userId: uid },
      { $inc: { lastNumber: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    
    const universalNumber = `${year}-${String(counterResult?.value?.lastNumber || 1).padStart(2, '0')}`;
    
    // Create new invoice
    const newInvoice = {
      id: `manual-${Date.now()}`,
      userId: uid,
      universalNumber,
      storeInvoiceNumber: `MAN-${universalNumber}`,
      storeName: invoiceData.storeName,
      amount: parseFloat(invoiceData.amount),
      status: 'unpaid' as const,
      customerName: invoiceData.customerName,
      customerEmail: invoiceData.customerEmail,
      createdAt: new Date().toISOString(),
      dueDate: invoiceData.dueDate,
      paymentMethod: invoiceData.paymentMethod || '',
      items: invoiceData.items || [],
      billingAddress: invoiceData.billingAddress || {},
      source: 'manual',
      savedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Save to universalInvoices collection
    const universalInvoicesCollection = db.collection('universalInvoices');
    await universalInvoicesCollection.insertOne(newInvoice);

    console.log(`Created new manual invoice: ${universalNumber}`);

    return NextResponse.json({ 
      message: 'Invoice created successfully.',
      invoice: newInvoice 
    }, { status: 201 });

  } catch (err) {
    console.error('Create invoice error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
