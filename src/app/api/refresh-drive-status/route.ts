import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    // Force update the Google Drive config to ensure it's marked as connected
    const googleDriveConfigCollection = db.collection('googleDriveConfig');
    const config = await googleDriveConfigCollection.findOne({ userId: uid });
    
    if (config && config.accessToken) {
      // Update the connection timestamp to "refresh" the connection
      await googleDriveConfigCollection.updateOne(
        { userId: uid },
        { 
          $set: {
            updatedAt: new Date().toISOString(),
            lastStatusCheck: new Date().toISOString()
          }
        }
      );
      
      console.log(`🔄 Refreshed Google Drive connection status for user ${uid}`);
      
      return NextResponse.json({
        success: true,
        connected: true,
        message: 'Google Drive connection status refreshed'
      });
    } else {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'No Google Drive configuration found'
      });
    }
  } catch (error) {
    console.error('Error refreshing connection status:', error);
    return NextResponse.json({
      error: 'Failed to refresh connection status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
