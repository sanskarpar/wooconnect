import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This endpoint forces an immediate backup regardless of timing
export async function POST(req: NextRequest) {
  try {
    console.log('🚨 FORCE BACKUP NOW endpoint called at:', new Date().toLocaleString());
    
    // For emergency backup, we might not require auth, or check if user is admin
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('⚡ FORCING IMMEDIATE BACKUP - ignoring timing rules');
    
    try {
      // Force backup regardless of timing
      await globalBackupManager.performGlobalBackup();
      
      console.log('✅ EMERGENCY BACKUP COMPLETED SUCCESSFULLY');
      return NextResponse.json({
        success: true,
        message: 'Emergency backup completed successfully',
        forced: true,
        timestamp: new Date().toISOString()
      });
    } catch (backupError) {
      console.error('❌ EMERGENCY BACKUP FAILED:', backupError);
      return NextResponse.json({
        success: false,
        message: 'Emergency backup failed',
        error: backupError instanceof Error ? backupError.message : 'Unknown backup error',
        forced: true,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in force backup now endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to perform emergency backup',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
