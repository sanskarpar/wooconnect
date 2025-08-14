import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;

    // Use server-side Google API configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/google-drive/callback`;

    if (!clientId || !clientSecret) {
      console.error('Missing Google API configuration in environment variables');
      return NextResponse.json({ 
        message: 'Google Drive integration is not configured. Please contact support.' 
      }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('OAuth config for auth URL:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri: redirectUri
    });

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: uid, // Pass user ID as state to identify user during callback
      prompt: 'consent' // Force consent screen to ensure refresh token
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ message: 'Failed to generate authentication URL.' }, { status: 500 });
  }
}
