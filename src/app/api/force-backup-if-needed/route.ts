import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This endpoint checks if a backup is needed and runs it immediately if so
export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Checking if backup is needed...');
    
    // Always check if backup is needed
    const needsBackup = await globalBackupManager.isBackupNeeded();
    
    if (needsBackup) {
      console.log('⚡ Backup is needed - running now');
      
      // Trigger the backup process
      await globalBackupManager.performGlobalBackup();
      
      return NextResponse.json({
        success: true,
        message: 'Backup was needed and has been triggered successfully',
        backupRun: true
      });
    } else {
      // Check when the next backup is due
      const minutesUntilNext = await globalBackupManager.getTimeUntilNextBackup();
      
      return NextResponse.json({
        success: true,
        message: `No backup needed at this time. Next backup in ${minutesUntilNext} minutes.`,
        backupRun: false,
        minutesUntilNext
      });
    }
  } catch (error) {
    console.error('Error checking backup need:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check backup need',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
