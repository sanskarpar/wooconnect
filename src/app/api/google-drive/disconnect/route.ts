import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    // Remove tokens but keep configuration
    await googleDriveConfigCollection.updateOne(
      { userId: uid },
      { 
        $unset: {
          accessToken: '',
          refreshToken: '',
          tokenExpiryDate: '',
          connectedAt: '',
        },
        $set: {
          updatedAt: new Date().toISOString(),
        }
      }
    );

    return NextResponse.json({ message: 'Successfully disconnected from Google Drive.' });
  } catch (error) {
    console.error('Error disconnecting from Google Drive:', error);
    return NextResponse.json({ message: 'Failed to disconnect from Google Drive.' }, { status: 500 });
  }
}
