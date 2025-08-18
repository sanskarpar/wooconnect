import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    const client = await clientPromise;
    const db = client.db('wooconnect');

    // Check all collections and count documents for this user
    const collections = await db.listCollections().toArray();
    const results: any = {};

    const userSpecificCollections = [
      'googleDriveConfig',
      'universalInvoices',
      'universalInvoiceSettings',
      'storeSettings', 
      'invoiceSettings',
      'invoiceBlacklist'
    ];

    for (const collectionName of userSpecificCollections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({ userId });
      const documents = await collection.find({ userId }).limit(5).toArray();
      
      results[collectionName] = {
        exists: collections.some(c => c.name === collectionName),
        documentCount: count,
        sampleDocuments: documents
      };
    }

    // Also check users collection
    const usersCollection = db.collection('users');
    const userDoc = await usersCollection.findOne({ _id: userId } as any);
    results.users = {
      exists: collections.some(c => c.name === 'users'),
      userDocument: userDoc ? 'Found' : 'Not found',
      sampleData: userDoc ? { _id: userDoc._id, email: userDoc.email } : null
    };

    return NextResponse.json({
      success: true,
      userId,
      allCollections: collections.map(c => c.name),
      userCollectionData: results
    });

  } catch (error) {
    console.error('Error debugging collections:', error);
    return NextResponse.json(
      { error: 'Failed to debug collections' },
      { status: 500 }
    );
  }
}
