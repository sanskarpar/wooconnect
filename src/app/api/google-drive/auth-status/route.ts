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

    return NextResponse.json({
      isConnected: !!config?.accessToken,
      connectedAt: config?.connectedAt || null,
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ message: 'Failed to check authentication status.' }, { status: 500 });
  }
}
