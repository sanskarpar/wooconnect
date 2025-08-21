import { NextRequest, NextResponse } from 'next/server';
import { GlobalBackupManager } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Backup scheduler initialization requested');
    
    // Initialize backup scheduler directly here
    const backupManager = GlobalBackupManager.getInstance();
    await backupManager.startGlobalBackupScheduler();
    
    return NextResponse.json({
      success: true,
      message: 'Backup scheduler initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing backup scheduler:', error);
    return NextResponse.json({
      error: 'Failed to initialize backup scheduler'
    }, { status: 500 });
  }
}
