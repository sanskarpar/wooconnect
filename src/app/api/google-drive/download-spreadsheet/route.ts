import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { GoogleDriveService } from '@/lib/googleDriveService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`📥 DOWNLOAD REQUEST: Starting spreadsheet download for user ${uid}`);

    const config = await GoogleDriveService.getConfigForUser(uid);
    if (!config || !config.accessToken) {
      return NextResponse.json({ 
        message: 'Google Drive not connected. Please connect first.' 
      }, { status: 400 });
    }

    if (!config.spreadsheetId) {
      return NextResponse.json({ 
        message: 'No Google Sheets ID configured. Please add a spreadsheet ID in settings.' 
      }, { status: 400 });
    }

    const driveService = new GoogleDriveService(config, uid);
    
    try {
      // Generate download URL for the spreadsheet
      const downloadUrl = await driveService.getSpreadsheetDownloadUrl(config.spreadsheetId);
      
      return NextResponse.json({ 
        message: 'Download URL generated successfully!',
        downloadUrl,
        spreadsheetId: config.spreadsheetId
      });
    } catch (error: any) {
      console.error('Download error:', error);
      if (error.code === 401) {
        // Try to refresh token
        const refreshed = await driveService.refreshAccessToken(uid);
        if (refreshed) {
          const downloadUrl = await driveService.getSpreadsheetDownloadUrl(config.spreadsheetId);
          return NextResponse.json({ 
            message: 'Download URL generated successfully!',
            downloadUrl,
            spreadsheetId: config.spreadsheetId
          });
        } else {
          return NextResponse.json({ 
            message: 'Google Drive connection expired. Please reconnect.' 
          }, { status: 401 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in download endpoint:', error);
    return NextResponse.json({ 
      message: 'Download failed. Please check your configuration.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
