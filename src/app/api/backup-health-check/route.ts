import { NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    // Get comprehensive scheduler status
  const schedulerStatus = globalBackupManager.getStatus();
  const backupStatus = await globalBackupManager.getBackupStatus();
    
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
    
    // If scheduler is not running, start it
    if (!schedulerStatus.running) {
      await globalBackupManager.startGlobalBackupScheduler();
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      scheduler: {
        isRunning: schedulerStatus.running,
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
      stats: {
        totalBackupsCount: recentBackupsCount,
        oldestBackupTime: oldestBackupTime || 'None',
        newestBackupTime: newestBackupTime || 'None'
  }
    };
    
    console.log('📊 HEALTH CHECK:', response);
    
  return NextResponse.json({ success: true, health: response });
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
