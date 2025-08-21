import { NextRequest, NextResponse } from 'next/server';
import { backupScheduler } from '@/lib/simpleBackupService';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Simple backup scheduler initialization requested');
    
    // Initialize backup scheduler
    await backupScheduler.start();
    
    return NextResponse.json({
      success: true,
      message: 'Simple backup scheduler initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing simple backup scheduler:', error);
    return NextResponse.json({
      error: 'Failed to initialize simple backup scheduler'
    }, { status: 500 });
  }
}
