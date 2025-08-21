import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerStatus } from '@/lib/initBackupScheduler';

export async function GET() {
  try {
    const status = getSchedulerStatus();
    return NextResponse.json({
      isRunning: status.isRunning,
      message: status.isRunning ? 'Backup scheduler is running' : 'Backup scheduler is stopped'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
