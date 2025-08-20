import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ 
        isConnected: false,
        connected: false,
        message: 'Unauthorized. Please log in.' 
      }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    const config = await googleDriveConfigCollection.findOne({ userId: uid });

    console.log(`Google Drive config check for user ${uid}:`, {
      hasConfig: !!config,
      hasAccessToken: !!config?.accessToken,
      hasRefreshToken: !!config?.refreshToken,
      tokenExpiry: config?.tokenExpiryDate,
      connectedAt: config?.connectedAt
    });

    if (!config || !config.accessToken) {
      console.log(`❌ No Google Drive config or access token for user ${uid}`);
      return NextResponse.json({
        isConnected: false,
        connected: false,
        connectedAt: null,
        message: 'Google Drive is not connected.'
      });
    }

    // Check if token is expired (be more lenient with expiry)
    const now = Date.now();
    const isExpired = config.tokenExpiryDate && config.tokenExpiryDate < (now - 300000); // 5 minute buffer
    
    console.log(`Google Drive status check for user ${uid}:`, {
      hasAccessToken: !!config.accessToken,
      hasRefreshToken: !!config.refreshToken,
      tokenExpiry: config.tokenExpiryDate,
      currentTime: now,
      isExpired,
      connectedAt: config.connectedAt
    });

    // Even if token is expired, if we have a refresh token, consider it connected
    const isConnected = !isExpired || !!config.refreshToken;

    return NextResponse.json({
      isConnected,
      connected: isConnected,
      expired: isExpired,
      hasRefreshToken: !!config.refreshToken,
      connectedAt: config?.connectedAt || null,
      message: isExpired ? (config.refreshToken ? 'Token expired but can be refreshed' : 'Token expired. Please reconnect.') : 'Google Drive is connected.'
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ 
      isConnected: false,
      connected: false,
      message: 'Failed to check authentication status.' 
    }, { status: 500 });
  }
}
