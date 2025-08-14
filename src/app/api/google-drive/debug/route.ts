import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// DEBUG ENDPOINT: Check what invoices exist in the database
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`🔍 DEBUG: Checking database for user ID: ${uid}`);
    
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const universalInvoicesCollection = db.collection('universalInvoices');

    // Get total count
    const totalCount = await universalInvoicesCollection.countDocuments({ userId: uid });
    console.log(`📊 Total invoices for user ${uid}: ${totalCount}`);

    // Get all invoices
    const allInvoices = await universalInvoicesCollection.find({ userId: uid }).toArray();
    
    // Get sample data
    const sampleData = allInvoices.slice(0, 3).map(invoice => ({
      universalNumber: invoice.universalNumber,
      storeName: invoice.storeName,
      customerName: invoice.customerName,
      amount: invoice.amount,
      createdAt: invoice.createdAt,
      source: invoice.source,
      uploadedToDrive: invoice.uploadedToDrive,
      driveLink: invoice.driveLink,
      hasUploadedField: 'uploadedToDrive' in invoice,
      hasDriveField: 'driveLink' in invoice
    }));

    // Check Google Drive config
    const googleDriveConfigCollection = db.collection('googleDriveConfig');
    const driveConfig = await googleDriveConfigCollection.findOne({ userId: uid });
    
    return NextResponse.json({
      userId: uid,
      totalInvoices: totalCount,
      invoicesFound: allInvoices.length,
      sampleInvoices: sampleData,
      googleDriveConnected: !!driveConfig?.accessToken,
      googleDriveConfig: driveConfig ? {
        hasAccessToken: !!driveConfig.accessToken,
        hasRefreshToken: !!driveConfig.refreshToken,
        folderId: driveConfig.folderId,
        spreadsheetId: driveConfig.spreadsheetId
      } : null
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      message: 'Debug check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
