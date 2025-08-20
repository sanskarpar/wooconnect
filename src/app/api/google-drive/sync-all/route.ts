import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { GoogleDriveService, uploadNewInvoiceToDrive } from '@/lib/googleDriveService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`🔄 SYNC ALL REQUEST: Starting complete re-sync for user ${uid}`);

    const config = await GoogleDriveService.getConfigForUser(uid);
    if (!config || !config.accessToken) {
      return NextResponse.json({ 
        message: 'Google Drive not connected. Please connect first.' 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Get all invoices for this user
    const allInvoices = await universalInvoicesCollection.find({ userId: uid }).toArray();
    console.log(`📊 FOUND ${allInvoices.length} invoices to re-sync`);

    if (allInvoices.length === 0) {
      return NextResponse.json({
        message: 'No invoices found to sync',
        processedCount: 0
      });
    }

    const driveService = new GoogleDriveService(config, uid);
    
    // Step 1: Delete all existing invoice files from Google Drive
    console.log(`🗑️ STEP 1: Deleting all existing invoice files from Google Drive...`);
    try {
      const deleteResult = await driveService.deleteAllInvoiceFiles();
      console.log(`🧹 Deleted ${deleteResult.deletedCount} existing invoice files from Google Drive`);
      if (deleteResult.errors.length > 0) {
        console.log(`⚠️ Some files couldn't be deleted:`, deleteResult.errors.slice(0, 3));
      }
    } catch (error) {
      console.error('❌ Error deleting existing files:', error);
      // Continue with upload even if deletion fails
    }
    
    // Step 2: Reset all upload status to force re-upload
    console.log(`🔄 STEP 2: Resetting upload status for all invoices`);
    await universalInvoicesCollection.updateMany(
      { userId: uid },
      { 
        $set: { 
          uploadedToDrive: false
        },
        $unset: { 
          driveLink: ""
        }
      }
    );

    // Step 3: Refresh invoice data with updated flags
    console.log(`📋 STEP 3: Refreshing invoice data with updated flags`);
    const refreshedInvoices = await universalInvoicesCollection.find({ userId: uid }).toArray();
    console.log(`📊 Refreshed ${refreshedInvoices.length} invoices with reset upload status`);

    // Step 4: Process each invoice in smaller batches to prevent timeouts
    let uploadedCount = 0;
    let errorCount = 0;
    const errors = [];
    const batchSize = 5; // Process 5 invoices at a time
    const totalInvoices = refreshedInvoices.length;

    console.log(`🚀 STEP 4: Starting upload process for ${totalInvoices} invoices in batches of ${batchSize}`);

    // Send immediate response to prevent timeout, then process in background
    const response = NextResponse.json({
      message: `Sync started! Processing ${totalInvoices} invoices in batches. Check back in a few minutes.`,
      totalInvoices,
      status: 'processing'
    });

    // Process invoices in background (don't await this)
    setImmediate(async () => {
      for (let i = 0; i < refreshedInvoices.length; i += batchSize) {
        const batch = refreshedInvoices.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalInvoices/batchSize)} (${batch.length} invoices)`);
        
        for (const invoice of batch) {
          try {
            console.log(`📄 Processing invoice: ${invoice.universalNumber}`);
            
            // Upload the invoice to Google Drive with timeout
            const uploadPromise = uploadNewInvoiceToDrive(uid, invoice, db);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout')), 30000)
            );
            
            const driveLink = await Promise.race([uploadPromise, timeoutPromise]);
            
            if (driveLink) {
              uploadedCount++;
              console.log(`✅ Successfully uploaded: ${invoice.universalNumber}`);
            } else {
              console.log(`⚠️ Failed to upload: ${invoice.universalNumber}`);
              errorCount++;
            }
          } catch (error) {
            errorCount++;
            const errorMsg = `Failed to upload ${invoice.universalNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
        
        // Add delay between batches to prevent overwhelming the API
        if (i + batchSize < refreshedInvoices.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`🎉 BACKGROUND SYNC COMPLETE: ${uploadedCount} uploaded, ${errorCount} errors`);
    });

    return response;

  } catch (error) {
    console.error('Error in sync-all endpoint:', error);
    return NextResponse.json({ 
      message: 'Sync failed. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
