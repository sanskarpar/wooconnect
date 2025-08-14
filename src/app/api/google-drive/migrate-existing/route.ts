import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// INTERNAL API: Used automatically by dashboard to initialize Google Drive fields for existing invoices
// This runs automatically when dashboard loads - NO MANUAL INTERACTION REQUIRED
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Find all invoices that don't have Google Drive fields
    const invoicesWithoutDriveFields = await universalInvoicesCollection.find({ 
      userId: uid,
      $or: [
        { uploadedToDrive: { $exists: false } },
        { driveLink: { $exists: false } }
      ]
    }).toArray();

    console.log(`Found ${invoicesWithoutDriveFields.length} existing invoices to initialize with Google Drive fields`);

    let updatedCount = 0;

    // Initialize Google Drive fields for all existing invoices
    for (const invoice of invoicesWithoutDriveFields) {
      try {
        await universalInvoicesCollection.updateOne(
          { _id: invoice._id },
          { 
            $set: { 
              uploadedToDrive: false,
              driveLink: undefined,
              lastUpdated: new Date().toISOString()
            }
          }
        );
        updatedCount++;
        console.log(`Initialized Google Drive fields for invoice ${invoice.universalNumber}`);
      } catch (error) {
        console.error(`Failed to initialize invoice ${invoice.universalNumber}:`, error);
      }
    }

    return NextResponse.json({
      message: `Successfully initialized Google Drive fields for ${updatedCount} existing invoices`,
      updatedCount,
      totalChecked: invoicesWithoutDriveFields.length
    });

  } catch (error) {
    console.error('Error initializing Google Drive fields:', error);
    return NextResponse.json({ 
      message: 'Failed to initialize Google Drive fields for existing invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
