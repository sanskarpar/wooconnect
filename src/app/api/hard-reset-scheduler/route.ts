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
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('🔄 HARD RESET: Completely restarting backup scheduler...');
    
    // Stop current scheduler completely
    await globalBackupManager.stopGlobalBackupScheduler();
    
    // Wait 3 seconds to ensure everything stops
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get current backup status before restart
    const beforeStatus = await globalBackupManager.getBackupStatus();
    
    // Use the dedicated restart function for a clean start
    await forceRestartBackupScheduler();
    
    // Get status after restart
    const afterStatus = await globalBackupManager.getBackupStatus();
    const schedulerStatus = globalBackupManager.getStatus();
    
    // Check for backup needs and force a backup
    console.log('⚡ HARD RESET: Running an immediate backup after restart');
    try {
      await globalBackupManager.performGlobalBackup();
      console.log('✅ HARD RESET: Immediate backup completed successfully');
    } catch (backupError) {
      console.error('❌ HARD RESET: Immediate backup failed:', backupError);
    }
    
    // Get final status after backup
    const finalStatus = await globalBackupManager.getBackupStatus();
    
    console.log('✅ HARD RESET: Backup scheduler completely restarted');
    
    return NextResponse.json({
      success: true,
      message: 'Backup scheduler completely restarted and immediate backup triggered',
      before: {
        lastBackup: beforeStatus.lastBackupTime ? new Date(beforeStatus.lastBackupTime).toLocaleString() : 'None',
        minutesUntilNext: beforeStatus.minutesUntilNext
      },
      after: {
        schedulerRunning: schedulerStatus.running,
        schedulerHasInterval: schedulerStatus.intervalId,
        lastBackup: finalStatus.lastBackupTime ? new Date(finalStatus.lastBackupTime).toLocaleString() : 'None',
        nextBackup: finalStatus.nextBackupFormatted,
        minutesUntilNext: finalStatus.minutesUntilNext
      }
    });
    
  } catch (error) {
    console.error('❌ HARD RESET: Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to restart backup scheduler',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
