import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No session found' 
      });
    }

    // Get current backup status
    const schedulerStatus = globalBackupManager.getStatus();
    const backupStatus = await globalBackupManager.getBackupStatus();

    return NextResponse.json({
      authenticated: true,
      userId: session.user.id,
      scheduler: {
        running: schedulerStatus.running,
        hasInterval: schedulerStatus.intervalId
      },
      backup: {
        lastBackup: backupStatus.lastBackupFormatted || 'Never',
        nextBackup: backupStatus.nextBackupFormatted || 'Not scheduled',
        minutesUntilNext: backupStatus.minutesUntilNext
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in backup status API:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
