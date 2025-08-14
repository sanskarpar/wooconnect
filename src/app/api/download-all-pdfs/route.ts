import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import clientPromise from '@/lib/mongodb';
import { generateProfessionalUKInvoicePDF, type InvoiceData, type InvoiceSettings } from '@/lib/invoicePdfGenerator';
import JSZip from 'jszip';

interface UniversalInvoice {
  id: string;
  universalNumber: string;
  storeInvoiceNumber: string;
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`📥 DOWNLOAD ALL PDFs REQUEST: Starting PDF generation for user ${uid}`);

    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    // Get all saved invoices from the universalInvoices collection
    const universalInvoicesCollection = db.collection('universalInvoices');
    const savedInvoices = await universalInvoicesCollection
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`Found ${savedInvoices.length} saved invoices`);

    if (savedInvoices.length === 0) {
      return NextResponse.json({ 
        message: 'No invoices found to generate PDFs.' 
      }, { status: 400 });
    }

    // Get invoice settings for PDF generation
    const settingsCollection = db.collection('invoiceSettings');
    const settingsDoc = await settingsCollection.findOne({ userId: uid });
    const settings: Partial<InvoiceSettings> = settingsDoc?.settings || {};

    // Create a new JSZip instance
    const zip = new JSZip();

    // Generate PDFs for each invoice and add to zip
    for (const invoice of savedInvoices) {
      try {
        const invoiceData: InvoiceData = {
          id: invoice.wooCommerceOrderId || invoice._id.toString(),
          number: invoice.storeInvoiceNumber,
          universalNumber: invoice.universalNumber,
          amount: invoice.amount,
          status: invoice.status,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          createdAt: invoice.createdAt,
          dueDate: invoice.dueDate,
          orderStatus: invoice.orderStatus,
          paymentMethod: invoice.paymentMethod,
          items: invoice.items || [],
          customerAddress: invoice.customerAddress || invoice.billingAddress || {},
        };

        // Generate PDF for this invoice
        const pdfBytes = await generateProfessionalUKInvoicePDF(invoiceData, settings, invoice.storeName);
        
        // Create a safe filename
        const safeCustomerName = invoice.customerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const filename = `Invoice_${invoice.universalNumber}_${safeCustomerName}.pdf`;
        
        // Add PDF to zip
        zip.file(filename, pdfBytes);
        
        console.log(`Generated PDF for invoice ${invoice.universalNumber}`);
      } catch (error) {
        console.error(`Error generating PDF for invoice ${invoice.universalNumber}:`, error);
        // Continue with other invoices even if one fails
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    // Create filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const zipFilename = `All_Invoices_${currentDate}.zip`;

    // Return the zip file as a download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Error in download all PDFs endpoint:', error);
    return NextResponse.json({ 
      message: 'Download failed. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
