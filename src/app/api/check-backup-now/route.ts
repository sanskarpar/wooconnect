import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('🔄 Manual backup check triggered by user:', session.user.id);
    
    // Get current backup status
    const status = await globalBackupManager.getBackupStatus();
    
    console.log('📊 Current backup status:', {
      lastBackupTime: status.lastBackupTime,
      minutesUntilNext: status.minutesUntilNext,
      shouldBackupNow: status.minutesUntilNext === 0
    });
    
    // Always trigger a backup when this endpoint is called
    console.log('⚡ Triggering immediate backup - manual request');
      
    // Trigger the backup process
    await globalBackupManager.performGlobalBackup();
      
    return NextResponse.json({
      success: true,
      message: 'Backup triggered successfully',
      wasRequested: true
    });
    
  } catch (error) {
    console.error('Error in backup check:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check/trigger backup'
    }, { status: 500 });
  }
}
