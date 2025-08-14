

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { v4 as uuidv4 } from 'uuid';
import { uploadInvoiceToDrive } from '@/lib/googleDriveService';
import { downloadInvoicePDF, type InvoiceData } from '@/lib/invoicePdfGenerator';

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
    const universalInvoicesCollection = db.collection('universalInvoices');

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
    const storeInvoiceNumber = `MAN-${universalNumber}`;

    // Create the invoice document for universalInvoices collection
    const invoiceDoc = {
      userId: uid,
      universalNumber,
      storeInvoiceNumber,
      storeName: storeName.trim(),
      wooCommerceOrderId: invoiceId, // Use invoiceId as a unique identifier
      amount: parseFloat(amount),
      status: 'unpaid' as const,
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() || '',
      createdAt: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      orderStatus: undefined, // Manual invoices don't have order status
      paymentMethod: paymentMethod?.trim() || '',
      customerAddress: billingAddress || {},
      items: Array.isArray(items) ? items.filter((item: any) => item.name?.trim()) : [],
      source: 'manual',
      savedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      uploadedToDrive: false, // Initialize as not uploaded
      driveLink: undefined
    };

    // Insert the invoice into universalInvoices collection
    const insertResult = await universalInvoicesCollection.insertOne(invoiceDoc);

    if (!insertResult.acknowledged) {
      return NextResponse.json({ message: 'Failed to create invoice.' }, { status: 500 });
    }

    // Try to upload to Google Drive automatically
    let driveLink: string | undefined;
    try {
      // Get settings for PDF generation
      const universalSettingsCollection = db.collection('universalInvoiceSettings');
      const settingsDoc = await universalSettingsCollection.findOne({ userId: uid });
      const settings = settingsDoc?.settings || {};

      // Convert to InvoiceData format
      const invoiceData: InvoiceData = {
        id: invoiceDoc.wooCommerceOrderId,
        number: invoiceDoc.storeInvoiceNumber,
        universalNumber: invoiceDoc.universalNumber,
        amount: invoiceDoc.amount,
        status: invoiceDoc.status,
        customerName: invoiceDoc.customerName,
        customerEmail: invoiceDoc.customerEmail,
        createdAt: invoiceDoc.createdAt,
        dueDate: invoiceDoc.dueDate,
        orderStatus: invoiceDoc.orderStatus,
        paymentMethod: invoiceDoc.paymentMethod,
        items: invoiceDoc.items || [],
        customerAddress: invoiceDoc.customerAddress || {},
      };

      // Generate PDF
      const pdfBytes = await downloadInvoicePDF(invoiceData, settings, invoiceDoc.storeName);
      const pdfBuffer = Buffer.from(pdfBytes);

      // Upload to Drive
      const fileName = `Invoice_${invoiceDoc.universalNumber}_${invoiceDoc.storeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const uploadResult = await uploadInvoiceToDrive(uid, fileName, pdfBuffer, invoiceDoc);

      if (uploadResult.driveLink) {
        driveLink = uploadResult.driveLink;
        
        // Update invoice with Drive link
        await universalInvoicesCollection.updateOne(
          { _id: insertResult.insertedId },
          { 
            $set: { 
              driveLink: driveLink,
              uploadedToDrive: true,
              driveUploadedAt: new Date().toISOString(),
            }
          }
        );
      }
    } catch (driveError) {
      console.error('Error uploading to Google Drive:', driveError);
      // Don't fail the invoice creation if Drive upload fails
    }

    // Return the created invoice
    return NextResponse.json({
      message: driveLink 
        ? 'Invoice created successfully and uploaded to Google Drive.' 
        : 'Invoice created successfully.',
      invoice: {
        id: invoiceDoc.wooCommerceOrderId,
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
        billingAddress: invoiceDoc.customerAddress,
        paymentMethod: invoiceDoc.paymentMethod,
        driveLink,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
