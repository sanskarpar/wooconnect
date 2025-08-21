import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getSchedulerStatus, forceBackupNow } from '@/lib/initBackupScheduler';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const status = getSchedulerStatus();
    
    return NextResponse.json({
      isRunning: status.isRunning,
      nextBackupIn: status.nextBackupIn,
      backupInterval: '30 minutes'
    });

  } catch (error) {
    console.error('Get backup scheduler status error:', error);
    return NextResponse.json({
      message: `Failed to get scheduler status: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'force-backup') {
      console.log(`🔥 Force backup requested by user: ${session.user.id}`);
      await forceBackupNow();
      
      return NextResponse.json({
        success: true,
        message: 'Force backup completed successfully.'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Use "force-backup" to trigger immediate backup.'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Backup scheduler action error:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
