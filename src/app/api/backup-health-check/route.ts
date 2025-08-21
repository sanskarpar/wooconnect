import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    // Get scheduler status
    const schedulerStatus = globalBackupManager.getStatus();
    const backupStatus = await globalBackupManager.getBackupStatus();
    
    // Get backup statistics
    let totalBackups = 0;
    let usersWithDriveConfigured = 0;
    
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Count total completed backups
      totalBackups = await db.collection('databaseBackups').countDocuments({
        status: 'completed'
      });
      
      // Count users with Google Drive configured
      usersWithDriveConfigured = await db.collection('googleDriveConfig').countDocuments({
        accessToken: { $exists: true, $ne: null }
      });
      
    } catch (dbError) {
      console.error('Error getting backup stats:', dbError);
    }
    
    return NextResponse.json({
      success: true,
      scheduler: {
        running: schedulerStatus.running,
        hasInterval: schedulerStatus.intervalId
      },
      timing: {
        lastBackup: backupStatus.lastBackupFormatted,
        nextBackup: backupStatus.nextBackupFormatted,
        minutesUntilNext: backupStatus.minutesUntilNext
      },
      statistics: {
        totalCompletedBackups: totalBackups,
        usersWithDriveConfigured: usersWithDriveConfigured
      },
      health: schedulerStatus.running ? 'healthy' : 'stopped',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in backup health check:', error);
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
