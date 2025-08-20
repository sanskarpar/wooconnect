import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';
import { forceRestartBackupScheduler } from '@/lib/initBackupScheduler';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { action } = await req.json().catch(() => ({ action: 'restart' }));
    
    if (action === 'restart') {
      console.log('🔄 Manual backup scheduler restart requested by user:', session.user.id);
      
      // Get status before restart
      const beforeStatus = globalBackupManager.getStatus();
      
      // Use the dedicated restart function to ensure proper cleanup
      const result = await forceRestartBackupScheduler();
      
      // Get status after restart
      const afterStatus = globalBackupManager.getStatus();
      
      // Check for immediate backup needs
      const backupStatus = await globalBackupManager.getBackupStatus();
      const needsBackup = await globalBackupManager.isBackupNeeded();
      
      if (needsBackup) {
        console.log('⚡ Backup needed after restart - running immediately');
        await globalBackupManager.performGlobalBackup();
      }
      
      return NextResponse.json({
        success: true,
        message: 'Backup scheduler restarted successfully',
        diagnostics: {
          before: beforeStatus,
          after: afterStatus,
          backupNeeded: needsBackup,
          minutesUntilNextBackup: backupStatus.minutesUntilNext
        }
      });
    } else if (action === 'status') {
      const status = globalBackupManager.getStatus();
      const backupStatus = await globalBackupManager.getBackupStatus();
      
      return NextResponse.json({
        success: true,
        schedulerStatus: status,
        backupStatus: {
          lastBackupTime: backupStatus.lastBackupTime ? new Date(backupStatus.lastBackupTime).toLocaleString() : null,
          nextBackupDue: backupStatus.nextBackupFormatted,
          minutesUntilNext: backupStatus.minutesUntilNext
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in backup scheduler operation:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to perform backup scheduler operation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}