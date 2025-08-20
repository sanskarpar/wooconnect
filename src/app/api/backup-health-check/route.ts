import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function GET() {
  try {
    // Get comprehensive scheduler status
    const schedulerStatus = globalBackupManager.getStatus();
    const backupStatus = await globalBackupManager.getBackupStatus();
    
    // Check if scheduler should be running but isn't
    const shouldRestart = !schedulerStatus.running && !schedulerStatus.initializing;
    
    const response = {
      timestamp: new Date().toISOString(),
      scheduler: {
        isRunning: schedulerStatus.running,
        isInitializing: schedulerStatus.initializing,
        hasInterval: schedulerStatus.intervalId
      },
      backup: {
        lastBackupTime: backupStatus.lastBackupTime,
        lastBackupFormatted: backupStatus.lastBackupTime ? new Date(backupStatus.lastBackupTime).toLocaleString() : 'Never',
        nextBackupTime: backupStatus.nextBackupTime,
        nextBackupFormatted: backupStatus.nextBackupFormatted || 'Not calculated',
        minutesUntilNext: backupStatus.minutesUntilNext,
        isOverdue: backupStatus.minutesUntilNext === 0
      },
      recommendations: {
        shouldRestart: shouldRestart,
        message: shouldRestart ? 'Scheduler is not running - consider restarting' : 'System appears to be working correctly'
      }
    };
    
    console.log('📊 HEALTH CHECK:', response);
    
    return NextResponse.json({
      success: true,
      health: response
    });
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
