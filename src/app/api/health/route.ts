import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
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

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          connected: dbConnected,
          userCount,
          usersWithGoogleDrive
        },
        googleDrive: {
          connectedUsers: usersWithGoogleDrive
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
