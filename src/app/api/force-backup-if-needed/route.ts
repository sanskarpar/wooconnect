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
      // Force a backup anyway when this endpoint is called
      console.log('✓ No backup needed at this time, but forcing one anyway since endpoint was called.');
      await globalBackupManager.performGlobalBackup();
      
      return NextResponse.json({
        success: true,
        message: 'Backup was forced even though not needed',
        backupRun: true
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
