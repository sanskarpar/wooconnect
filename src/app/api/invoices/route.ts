

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const { storeName, customerName, customerEmail, amount, dueDate, items, billingAddress, paymentMethod } = await req.json();

    // Validation
    if (!storeName?.trim()) {
      return NextResponse.json({ message: 'Store name is required.' }, { status: 400 });
    }
    if (!customerName?.trim()) {
      return NextResponse.json({ message: 'Customer name is required.' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: 'Valid amount is required.' }, { status: 400 });
    }
    if (!dueDate) {
      return NextResponse.json({ message: 'Due date is required.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const invoicesCollection = db.collection('invoices');

    // Get the current year for universal numbering
    const currentYear = new Date().getFullYear().toString();

    // Create a collection to track universal invoice numbers if it doesn't exist
    const universalNumbersCollection = db.collection('universalNumbers');
    
    // Find and increment the counter for this year
    const counterResult = await universalNumbersCollection.findOneAndUpdate(
      { year: currentYear, userId: uid },
      { $inc: { lastNumber: 1 } },
      { 
        upsert: true, 
        returnDocument: 'after',
        projection: { lastNumber: 1 }
      }
    );

    const nextUniversalNumber = (counterResult?.value?.lastNumber as number) || 1;
    const universalNumber = `${currentYear}-${String(nextUniversalNumber).padStart(2, '0')}`;

    // Generate unique invoice ID and store invoice number
    const invoiceId = uuidv4();
    const storeInvoiceNumber = `INV-${Date.now()}`;

    // Create the invoice document
    const invoiceDoc = {
      id: invoiceId,
      universalNumber,
      storeInvoiceNumber,
      storeName: storeName.trim(),
      amount: parseFloat(amount),
      status: 'unpaid' as const,
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() || '',
      createdAt: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      items: Array.isArray(items) ? items.filter((item: any) => item.name?.trim()) : [],
      billingAddress: billingAddress || {},
      paymentMethod: paymentMethod?.trim() || '',
      userId: uid,
      isManual: true, // Flag to distinguish from WooCommerce invoices
    };

    // Insert the invoice
    const insertResult = await invoicesCollection.insertOne(invoiceDoc);

    if (!insertResult.acknowledged) {
      return NextResponse.json({ message: 'Failed to create invoice.' }, { status: 500 });
    }

    // Return the created invoice
    return NextResponse.json({
      message: 'Invoice created successfully.',
      invoice: {
        id: invoiceDoc.id,
        universalNumber: invoiceDoc.universalNumber,
        storeInvoiceNumber: invoiceDoc.storeInvoiceNumber,
        storeName: invoiceDoc.storeName,
        amount: invoiceDoc.amount,
        status: invoiceDoc.status,
        customerName: invoiceDoc.customerName,
        customerEmail: invoiceDoc.customerEmail,
        createdAt: invoiceDoc.createdAt,
        dueDate: invoiceDoc.dueDate,
        items: invoiceDoc.items,
        billingAddress: invoiceDoc.billingAddress,
        paymentMethod: invoiceDoc.paymentMethod,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
