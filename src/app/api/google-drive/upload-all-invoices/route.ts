import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { GoogleDriveService, uploadInvoiceToDrive } from '@/lib/googleDriveService';
import { downloadInvoicePDF, type InvoiceData } from '@/lib/invoicePdfGenerator';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const config = await GoogleDriveService.getConfigForUser(uid);

    if (!config || !config.accessToken) {
      return NextResponse.json({ 
        message: 'Google Drive not connected. Please connect first.' 
      }, { status: 400 });
    }

    // Get all invoices for this user
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');
    const universalSettingsCollection = db.collection('universalInvoiceSettings');

    const invoices = await universalInvoicesCollection
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .toArray();

    if (invoices.length === 0) {
      return NextResponse.json({ 
        message: 'No invoices found to upload.' 
      }, { status: 400 });
    }

    // Get settings for PDF generation
    const settingsDoc = await universalSettingsCollection.findOne({ userId: uid });
    const settings = settingsDoc?.settings || {};

    let uploadedCount = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        // Convert to InvoiceData format
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

        // Generate PDF
        const pdfBytes = await downloadInvoicePDF(invoiceData, settings, invoice.storeName);
        
        if (!pdfBytes) {
          errors.push(`Failed to generate PDF for invoice ${invoice.universalNumber}`);
          continue;
        }

        // Convert Uint8Array to Buffer
        const pdfBuffer = Buffer.from(pdfBytes);

        // Upload to Drive
        const fileName = `Invoice_${invoice.universalNumber}_${invoice.storeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const result = await uploadInvoiceToDrive(uid, fileName, pdfBuffer, invoice);

        if (result.error) {
          errors.push(`Upload failed for ${invoice.universalNumber}: ${result.error}`);
        } else {
          uploadedCount++;
          
          // Update invoice with Drive link
          await universalInvoicesCollection.updateOne(
            { _id: invoice._id },
            { 
              $set: { 
                driveLink: result.driveLink,
                uploadedToDrive: true,
                driveUploadedAt: new Date().toISOString(),
              }
            }
          );
        }
      } catch (error) {
        console.error(`Error processing invoice ${invoice.universalNumber}:`, error);
        errors.push(`Processing failed for ${invoice.universalNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({ 
      message: `Upload completed. ${uploadedCount} invoices uploaded successfully.`,
      uploadedCount,
      totalInvoices: invoices.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json({ 
      message: 'Bulk upload failed. Please try again.' 
    }, { status: 500 });
  }
}
