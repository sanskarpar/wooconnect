import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { SimpleBackupService } from '@/lib/simpleBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const backupService = new SimpleBackupService(userId);
    
    // Check if backup is needed (30 minutes since last backup)
    const lastBackupTime = await backupService.getLastBackupTime();
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    let isNeeded = false;
    
    if (!lastBackupTime) {
      console.log(`⚡ No previous backup found for user ${userId} - backup needed`);
      isNeeded = true;
    } else {
      const timeSinceLastBackup = now - lastBackupTime;
      isNeeded = timeSinceLastBackup >= thirtyMinutes;
      
      if (isNeeded) {
        const minutesSinceLastBackup = Math.floor(timeSinceLastBackup / (60 * 1000));
        console.log(`⚡ Backup needed for user ${userId} (${minutesSinceLastBackup} minutes since last backup)`);
      }
    }
    
    if (isNeeded) {
      console.log(`🔄 Force backup triggered for user: ${userId}`);
      const result = await backupService.createBackup();
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Force backup completed successfully',
          backupId: result.backupId,
          totalDocuments: result.totalDocuments
        });
      } else {
        return NextResponse.json({
          success: false,
          message: result.error || 'Force backup failed'
        }, { status: 500 });
      }
    } else {
      const minutesLeft = Math.ceil((thirtyMinutes - (now - lastBackupTime!)) / (60 * 1000));
      return NextResponse.json({
        success: true,
        message: `Backup not needed yet. Next backup in ${minutesLeft} minutes.`,
        minutesUntilNext: minutesLeft
      });
    }
  } catch (error) {
    console.error('❌ Error in force backup check:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
