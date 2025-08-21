import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function GET() {
  try {
    const status = await globalBackupManager.getBackupStatus();
    const now = Date.now();
    
    const debugInfo = {
      currentTime: {
        timestamp: now,
        formatted: new Date(now).toLocaleString(),
        iso: new Date(now).toISOString()
      },
      lastBackup: {
        timestamp: status.lastBackupTime,
        formatted: status.lastBackupTime ? new Date(status.lastBackupTime).toLocaleString() : null,
        iso: status.lastBackupTime ? new Date(status.lastBackupTime).toISOString() : null,
        minutesAgo: status.lastBackupTime ? Math.floor((now - status.lastBackupTime) / (60 * 1000)) : null
      },
      nextBackup: {
        timestamp: status.nextBackupTime,
        formatted: status.nextBackupFormatted,
        iso: status.nextBackupTime ? new Date(status.nextBackupTime).toISOString() : null,
        minutesFromNow: status.minutesUntilNext,
        isInFuture: status.nextBackupTime ? status.nextBackupTime > now : false
      },
      scheduler: {
        isRunning: status.isRunning,
        interval: globalBackupManager.BACKUP_INTERVAL,
        intervalMinutes: globalBackupManager.BACKUP_INTERVAL / (60 * 1000)
      },
      calculations: {
        timeSinceLastBackup: status.lastBackupTime ? now - status.lastBackupTime : null,
        timeUntilNextBackup: status.nextBackupTime ? status.nextBackupTime - now : null,
        shouldBackupBe: status.lastBackupTime ? status.lastBackupTime + globalBackupManager.BACKUP_INTERVAL : null,
        shouldBackupBeFormatted: status.lastBackupTime ? new Date(status.lastBackupTime + globalBackupManager.BACKUP_INTERVAL).toLocaleString() : null
      }
    };
    
    return NextResponse.json({
      success: true,
      debug: debugInfo
    });
    
  } catch (error) {
    console.error('Error in backup timing debug:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get debug info'
    }, { status: 500 });
  }
}
