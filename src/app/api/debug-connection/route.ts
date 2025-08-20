import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    // Check NextAuth session data
    const accounts = db.collection('accounts');
    const userAccounts = await accounts.find({ userId: uid }).toArray();
    
    // Check Google Drive config
    const googleDriveConfigCollection = db.collection('googleDriveConfig');
    const driveConfig = await googleDriveConfigCollection.findOne({ userId: uid });
    
    // Check recent backups
    const backupsCollection = db.collection('databaseBackups');
    const recentBackups = await backupsCollection
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    const now = Date.now();
    const driveTokenExpired = driveConfig?.tokenExpiryDate && driveConfig.tokenExpiryDate < now;

    return NextResponse.json({
      userId: uid,
      session: {
        hasSession: !!session,
        userId: session.user?.id
      },
      accounts: {
        total: userAccounts.length,
        providers: userAccounts.map(acc => acc.provider),
        googleAccount: userAccounts.find(acc => acc.provider === 'google')
      },
      googleDrive: {
        hasConfig: !!driveConfig,
        hasAccessToken: !!driveConfig?.accessToken,
        hasRefreshToken: !!driveConfig?.refreshToken,
        tokenExpiry: driveConfig?.tokenExpiryDate,
        tokenExpired: driveTokenExpired,
        connectedAt: driveConfig?.connectedAt,
        folderId: driveConfig?.folderId
      },
      backups: {
        total: recentBackups.length,
        recent: recentBackups.map(backup => ({
          id: backup.backupId,
          createdAt: backup.createdAt,
          status: backup.status
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
