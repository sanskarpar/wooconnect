import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';

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
    
    // Start fresh scheduler
    await globalBackupManager.startGlobalBackupScheduler();
    
    // Get status after restart
    const afterStatus = await globalBackupManager.getBackupStatus();
    
    console.log('✅ HARD RESET: Backup scheduler completely restarted');
    
    return NextResponse.json({
      success: true,
      message: 'Backup scheduler completely restarted',
      before: {
        lastBackup: beforeStatus.lastBackupTime ? new Date(beforeStatus.lastBackupTime).toLocaleString() : 'None',
        minutesUntilNext: beforeStatus.minutesUntilNext
      },
      after: {
        lastBackup: afterStatus.lastBackupTime ? new Date(afterStatus.lastBackupTime).toLocaleString() : 'None',
        nextBackup: afterStatus.nextBackupFormatted,
        minutesUntilNext: afterStatus.minutesUntilNext,
        schedulerRunning: globalBackupManager.getStatus().running
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
