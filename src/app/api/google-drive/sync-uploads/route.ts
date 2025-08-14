import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { uploadNewInvoiceToDrive } from '@/lib/googleDriveService';

// INTERNAL API: Automatically uploads all unuploaded invoices to Google Drive
// Triggered automatically by dashboard load, invoice creation, and WooCommerce sync
// NO MANUAL INTERACTION REQUIRED - FULLY AUTOMATIC
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`🔐 USER AUTHENTICATION: Checking invoices for user ID: ${uid}`);
    
    const client = await clientPromise;
    const db = client.db('wooconnect');

    // Check if Google Drive is connected
    const googleDriveConfigCollection = db.collection('googleDriveConfig');
    const driveConfig = await googleDriveConfigCollection.findOne({ userId: uid });

    if (!driveConfig?.accessToken) {
      return NextResponse.json({ 
        message: 'Google Drive not connected',
        uploadedCount: 0 
      });
    }

    // Get ALL invoices from universalInvoices collection first
    const universalInvoicesCollection = db.collection('universalInvoices');
    
    // First, let's see how many total invoices exist for this user
    const totalInvoicesCount = await universalInvoicesCollection.countDocuments({ userId: uid });
    console.log(`📊 TOTAL INVOICES IN DATABASE: ${totalInvoicesCount} invoices for user ${uid}`);
    
    if (totalInvoicesCount === 0) {
      console.log(`❌ NO INVOICES FOUND: No invoices exist in universalInvoices collection for user ${uid}`);
      return NextResponse.json({
        message: 'No invoices found in database',
        uploadedCount: 0,
        totalChecked: 0
      });
    }
    
    // Get ALL invoices for this user (let's check what exists)
    const allInvoices = await universalInvoicesCollection.find({ userId: uid }).toArray();
    console.log(`📋 ALL INVOICES FOUND: ${allInvoices.length} invoices`);
    
    // Log some sample invoice data to debug
    if (allInvoices.length > 0) {
      console.log(`🔍 SAMPLE INVOICE DATA:`, {
        universalNumber: allInvoices[0].universalNumber,
        storeName: allInvoices[0].storeName,
        hasUploadedToDrive: 'uploadedToDrive' in allInvoices[0],
        uploadedToDriveValue: allInvoices[0].uploadedToDrive,
        hasDriveLink: 'driveLink' in allInvoices[0],
        driveLinkValue: allInvoices[0].driveLink
      });
    }
    
    // Find invoices that need to be uploaded - using simple logic
    const unuploadedInvoices = allInvoices.filter(invoice => {
      // If uploadedToDrive doesn't exist OR is false OR is null, include it
      return !invoice.uploadedToDrive || invoice.uploadedToDrive === false || invoice.uploadedToDrive === null;
    });

    console.log(`🔍 AUTOMATIC SCAN: Found ${unuploadedInvoices.length} invoices to upload out of ${allInvoices.length} total invoices`);

    let uploadedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each invoice that needs to be checked/uploaded
    for (const invoice of unuploadedInvoices) {
      try {
        // For existing invoices without uploadedToDrive field, initialize it
        if (invoice.uploadedToDrive === undefined) {
          console.log(`📝 Initializing Google Drive tracking for existing invoice: ${invoice.universalNumber}`);
          await universalInvoicesCollection.updateOne(
            { _id: invoice._id },
            { 
              $set: { 
                uploadedToDrive: false,
                driveLink: undefined
              }
            }
          );
          invoice.uploadedToDrive = false; // Update local object for processing
        }

        // Skip if already uploaded (double-check to prevent duplicates)
        if (invoice.uploadedToDrive === true && invoice.driveLink) {
          skippedCount++;
          continue;
        }

        console.log(`⬆️ Uploading invoice ${invoice.universalNumber} (${invoice.source || 'manual'}) to Google Drive...`);
        const result = await uploadNewInvoiceToDrive(uid, invoice, db);
        if (result) {
          uploadedCount++;
          console.log(`✅ Successfully uploaded invoice ${invoice.universalNumber} (${invoice.source || 'manual'}) to Google Drive`);
        } else {
          console.log(`⚠️ Invoice ${invoice.universalNumber} was already uploaded or failed upload`);
        }
      } catch (error) {
        console.error(`❌ Failed to upload invoice ${invoice.universalNumber}:`, error);
        errors.push({
          invoiceNumber: invoice.universalNumber,
          storeName: invoice.storeName,
          source: invoice.source || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 AUTOMATIC UPLOAD COMPLETE: ${uploadedCount} uploaded, ${skippedCount} already uploaded, ${errors.length} errors`);

    return NextResponse.json({
      message: uploadedCount > 0 
        ? `Successfully uploaded ${uploadedCount} invoices to Google Drive` 
        : `All invoices already uploaded (checked ${unuploadedInvoices.length} invoices)`,
      uploadedCount,
      skippedCount,
      totalChecked: unuploadedInvoices.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing invoices to Google Drive:', error);
    return NextResponse.json({ 
      message: 'Failed to sync invoices to Google Drive',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
