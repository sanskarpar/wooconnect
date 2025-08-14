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
      config: config ? {
        folderId: config.folderId || '',
        spreadsheetId: config.spreadsheetId || '',
        isConnected: !!config.accessToken,
      } : {
        folderId: '',
        spreadsheetId: '',
        isConnected: false,
      }
    });
  } catch (error) {
    console.error('Error fetching Google Drive config:', error);
    return NextResponse.json({ message: 'Failed to fetch configuration.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const { folderId, spreadsheetId } = await req.json();

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    // Update or create configuration (only folder and spreadsheet settings)
    const updateDoc = {
      $set: {
        folderId: folderId?.trim() || '',
        spreadsheetId: spreadsheetId?.trim() || '',
        updatedAt: new Date().toISOString(),
      }
    };

    await googleDriveConfigCollection.updateOne(
      { userId: uid },
      updateDoc,
      { upsert: true }
    );

    // Get updated config to return
    const config = await googleDriveConfigCollection.findOne({ userId: uid });

    return NextResponse.json({
      message: 'Configuration saved successfully.',
      config: {
        folderId: config?.folderId || '',
        spreadsheetId: config?.spreadsheetId || '',
        isConnected: !!config?.accessToken,
      }
    });
  } catch (error) {
    console.error('Error saving Google Drive config:', error);
    return NextResponse.json({ message: 'Failed to save configuration.' }, { status: 500 });
  }
}
