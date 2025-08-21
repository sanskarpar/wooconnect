import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerStatus } from '@/lib/initBackupScheduler';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    // Get comprehensive scheduler status
    const schedulerStatus = globalBackupManager.getStatus();
    const backupStatus = await globalBackupManager.getBackupStatus();
    
    // Check if scheduler should be running but isn't
    const shouldRestart = !schedulerStatus.running && !schedulerStatus.initializing;
    
    // Get some stats about recent backups
    let recentBackupsCount = 0;
    let oldestBackupTime = null;
    let newestBackupTime = null;
    
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Count total backups
      recentBackupsCount = await db.collection('databaseBackups').countDocuments({});
      
      // Get oldest backup
      const oldestBackup = await db.collection('databaseBackups')
        .find({})
        .sort({ createdAt: 1 })
        .limit(1)
        .toArray();
        
      if (oldestBackup.length > 0) {
        oldestBackupTime = new Date(oldestBackup[0].createdAt).toLocaleString();
      }
      
      // Get newest backup (should match lastBackupTime but double-check)
      const newestBackup = await db.collection('databaseBackups')
        .find({})
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
        
      if (newestBackup.length > 0) {
        newestBackupTime = new Date(newestBackup[0].createdAt).toLocaleString();
      }
    } catch (dbError) {
      console.error('Error getting backup stats:', dbError);
    }
    
    // If scheduler is not running, try to restart it
    if (shouldRestart) {
      try {
        console.log('🔄 Health check detected scheduler not running - attempting restart');
        await initializeBackupScheduler();
        console.log('✅ Scheduler restarted by health check');
      } catch (restartError) {
        console.error('❌ Health check failed to restart scheduler:', restartError);
      }
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      scheduler: {
        isRunning: schedulerStatus.running,
        isInitializing: schedulerStatus.initializing,
        hasInterval: schedulerStatus.intervalId,
        autoRestartAttempted: shouldRestart
      },
      backup: {
        lastBackupTime: backupStatus.lastBackupTime,
        lastBackupFormatted: backupStatus.lastBackupTime ? new Date(backupStatus.lastBackupTime).toLocaleString() : 'Never',
        nextBackupTime: backupStatus.nextBackupTime,
        nextBackupFormatted: backupStatus.nextBackupFormatted || 'Not calculated',
        minutesUntilNext: backupStatus.minutesUntilNext,
        isOverdue: backupStatus.minutesUntilNext === 0
      },
      stats: {
        totalBackupsCount: recentBackupsCount,
        oldestBackupTime: oldestBackupTime || 'None',
        newestBackupTime: newestBackupTime || 'None'
      },
      recommendations: {
        shouldRestart: shouldRestart,
        message: shouldRestart ? 'Scheduler is not running - auto-restart attempted' : 'System appears to be working correctly'
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
