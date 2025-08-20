import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function POST() {
  try {
    console.log('🔄 FORCE BACKUP: Manual trigger initiated');
    
    // Get current backup status
    const status = await globalBackupManager.getBackupStatus();
    
    console.log('📊 FORCE BACKUP: Current status:', {
      lastBackup: status.lastBackupTime ? new Date(status.lastBackupTime).toLocaleString() : 'None',
      minutesUntilNext: status.minutesUntilNext,
      isOverdue: status.minutesUntilNext === 0
    });
    
    // Force run backup regardless of timing
    console.log('⚡ FORCE BACKUP: Triggering backup now...');
    await globalBackupManager.performGlobalBackup();
    
    // Get updated status
    const newStatus = await globalBackupManager.getBackupStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Backup completed successfully',
      previousStatus: {
        lastBackup: status.lastBackupTime ? new Date(status.lastBackupTime).toLocaleString() : 'None',
        minutesUntilNext: status.minutesUntilNext
      },
      newStatus: {
        lastBackup: newStatus.lastBackupTime ? new Date(newStatus.lastBackupTime).toLocaleString() : 'None',
        nextBackup: newStatus.nextBackupFormatted,
        minutesUntilNext: newStatus.minutesUntilNext
      }
    });
    
  } catch (error) {
    console.error('❌ FORCE BACKUP: Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to force backup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
