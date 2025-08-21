import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerStatus } from '@/lib/initBackupScheduler';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    // Check scheduler status
    const schedulerStatus = getSchedulerStatus();
    
    // Check database connectivity
    let dbStatus = 'disconnected';
    let backupCollectionExists = false;
    let totalBackupsInSystem = 0;
    
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Test database connection
      await db.admin().ping();
      dbStatus = 'connected';
      
      // Check if backup collection exists
      const collections = await db.listCollections({ name: 'invoiceBackups' }).toArray();
      backupCollectionExists = collections.length > 0;
      
      // Count total backups in system
      if (backupCollectionExists) {
        const backupsCollection = db.collection('invoiceBackups');
        totalBackupsInSystem = await backupsCollection.countDocuments({ status: 'completed' });
      }
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
    }

    // Count users with Google Drive connected
    let usersWithDriveConnected = 0;
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const googleDriveConfigCollection = db.collection('googleDriveConfig');
      usersWithDriveConnected = await googleDriveConfigCollection.countDocuments({
        accessToken: { $exists: true, $ne: null }
      });
    } catch (error) {
      console.error('Failed to count users with Google Drive:', error);
    }

    const healthStatus = {
      timestamp: new Date().toISOString(),
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      components: {
        scheduler: {
          status: schedulerStatus.isRunning ? 'running' as const : 'stopped' as const,
          isRunning: schedulerStatus.isRunning,
          nextBackupIn: schedulerStatus.nextBackupIn
        },
        database: {
          status: dbStatus,
          backupCollectionExists,
          totalBackupsInSystem
        },
        googleDrive: {
          usersConnected: usersWithDriveConnected
        }
      }
    };

    // Determine overall health
    if (!schedulerStatus.isRunning || dbStatus !== 'connected') {
      healthStatus.overall = 'degraded';
    }

    return NextResponse.json(healthStatus);

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      components: {
        scheduler: { status: 'unknown' as const },
        database: { status: 'unknown' as const },
        googleDrive: { status: 'unknown' as const }
      }
    }, { status: 500 });
  }
}