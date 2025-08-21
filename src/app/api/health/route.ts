import { NextRequest, NextResponse } from 'next/server';
import { backupScheduler } from '@/lib/simpleBackupService';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const schedulerStatus = backupScheduler.getStatus();
    
    // Check database connectivity
    let dbConnected = false;
    let userCount = 0;
    let usersWithGoogleDrive = 0;
    
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Test database connection
      await db.admin().ping();
      dbConnected = true;
      
      // Get user statistics
      const usersCollection = db.collection('users');
      userCount = await usersCollection.countDocuments();
      
      const googleDriveConfigCollection = db.collection('googleDriveConfig');
      usersWithGoogleDrive = await googleDriveConfigCollection.countDocuments({
        accessToken: { $exists: true, $ne: null }
      });
      
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Get recent backup count
    let recentBackupCount = 0;
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupCollection = db.collection('databaseBackups');
      
      // Count backups from last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      recentBackupCount = await backupCollection.countDocuments({
        createdAt: { $gte: yesterday.toISOString() }
      });
    } catch (error) {
      console.error('Backup count check failed:', error);
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          connected: dbConnected,
          userCount,
          usersWithGoogleDrive
        },
        backupScheduler: {
          running: schedulerStatus.running,
          hasInterval: schedulerStatus.running,
          nextCheck: schedulerStatus.nextCheck
        },
        backups: {
          recentCount: recentBackupCount,
          lastCheck: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
