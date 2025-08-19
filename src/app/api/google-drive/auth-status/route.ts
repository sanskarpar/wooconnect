import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    const config = await googleDriveConfigCollection.findOne({ userId: uid });

    if (!config || !config.accessToken) {
      return NextResponse.json({
        isConnected: false,
        connected: false,
        connectedAt: null,
        message: 'Google Drive is not connected.'
      });
    }

    // Check if token is expired
    const now = Date.now();
    const isExpired = config.tokenExpiryDate && config.tokenExpiryDate < now;

    return NextResponse.json({
      isConnected: !isExpired,
      connected: !isExpired,
      expired: isExpired,
      connectedAt: config?.connectedAt || null,
      message: isExpired ? 'Token expired. Please reconnect.' : 'Google Drive is connected.'
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ message: 'Failed to check authentication status.' }, { status: 500 });
  }
}
