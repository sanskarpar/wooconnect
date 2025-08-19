import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { GlobalBackupManager } from '@/lib/databaseBackupService';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No session found' 
      }, { status: 401 });
    }

    const backupManager = GlobalBackupManager.getInstance();
    const status = backupManager.getStatus();

    return NextResponse.json({
      authenticated: true,
      userId: session.user.id,
      backupScheduler: {
        running: status.running,
        hasInterval: status.intervalId,
        initializing: status.initializing
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in backup scheduler status API:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { action } = await req.json().catch(() => ({ action: 'status' }));
    const backupManager = GlobalBackupManager.getInstance();

    if (action === 'start') {
      await backupManager.startGlobalBackupScheduler();
      return NextResponse.json({ 
        success: true, 
        message: 'Backup scheduler started',
        status: backupManager.getStatus()
      });
    } else if (action === 'stop') {
      await backupManager.stopGlobalBackupScheduler();
      return NextResponse.json({ 
        success: true, 
        message: 'Backup scheduler stopped',
        status: backupManager.getStatus()
      });
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use "start" or "stop"' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in backup scheduler control API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
