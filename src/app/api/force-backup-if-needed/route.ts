import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This endpoint checks if a backup is needed and runs it immediately if so
export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Force backup endpoint called at:', new Date().toLocaleString());
    
    // Check if backup is needed first
    const needsBackup = await globalBackupManager.isBackupNeeded();
    
    console.log(`📊 Backup needed: ${needsBackup}`);
    
    if (needsBackup) {
      console.log('⚡ Backup is needed - running now');
      
      try {
        // Trigger the backup process
        await globalBackupManager.performGlobalBackup();
        
        console.log('✅ Force backup completed successfully');
        return NextResponse.json({
          success: true,
          message: 'Backup was needed and has been completed successfully',
          backupRun: true,
          timestamp: new Date().toISOString()
        });
      } catch (backupError) {
        console.error('❌ Force backup failed:', backupError);
        return NextResponse.json({
          success: false,
          message: 'Backup was needed but failed to complete',
          error: backupError instanceof Error ? backupError.message : 'Unknown backup error',
          backupRun: false,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    } else {
      const minutesLeft = await globalBackupManager.getTimeUntilNextBackup();
      console.log(`✓ No backup needed at this time. Next backup in ${minutesLeft} minutes.`);
      
      return NextResponse.json({
        success: true,
        message: `No backup needed at this time. Next backup in ${minutesLeft} minutes.`,
        backupRun: false,
        minutesUntilNext: minutesLeft,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Error in force backup endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check backup need or perform backup',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
