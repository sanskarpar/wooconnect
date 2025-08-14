import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the user ID
    const error = searchParams.get('error');

    if (error) {
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `, { 
        status: 400, 
        headers: { 'Content-Type': 'text/html' } 
      });
    }

    if (!code || !state) {
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Missing authorization code or user state.</p>
            <script>window.close();</script>
          </body>
        </html>
      `, { 
        status: 400, 
        headers: { 'Content-Type': 'text/html' } 
      });
    }

    const uid = state;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    // Use server-side Google API configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/google-drive/callback`;

    if (!clientId || !clientSecret) {
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>Google Drive integration is not configured on the server.</p>
            <script>window.close();</script>
          </body>
        </html>
      `, { 
        status: 500, 
        headers: { 'Content-Type': 'text/html' } 
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('OAuth config for token exchange:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri: redirectUri
    });

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database (create/update user's Google Drive connection)
    await googleDriveConfigCollection.updateOne(
      { userId: uid },
      { 
        $set: {
          userId: uid,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiryDate: tokens.expiry_date,
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
      { upsert: true }
    );

    return new Response(`
      <html>
        <body>
          <h1>Authorization Successful!</h1>
          <p>Google Drive has been connected successfully. You can close this window.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `, { 
      status: 200, 
      headers: { 'Content-Type': 'text/html' } 
    });
  } catch (error) {
    console.error('Error in Google Drive callback:', error);
    
    // Provide more specific error messages
    let errorMessage = 'An error occurred during authorization. Please try again.';
    
    if (error instanceof Error) {
      if (error.message.includes('invalid_client')) {
        errorMessage = 'Invalid client credentials. Please check your Client ID and Client Secret in Google Cloud Console.';
      } else if (error.message.includes('redirect_uri_mismatch')) {
        errorMessage = 'Redirect URI mismatch. Please ensure your Google Cloud Console redirect URI matches your application URL.';
      } else if (error.message.includes('invalid_grant')) {
        errorMessage = 'Authorization code expired or invalid. Please try connecting again.';
      }
    }
    
    return new Response(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>${errorMessage}</p>
          <p><small>Technical details: ${error instanceof Error ? error.message : 'Unknown error'}</small></p>
          <script>window.close();</script>
        </body>
      </html>
    `, { 
      status: 500, 
      headers: { 'Content-Type': 'text/html' } 
    });
  }
}
