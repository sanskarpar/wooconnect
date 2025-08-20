import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { initializeBackupScheduler } from '@/lib/initBackupScheduler';
import { GlobalBackupManager } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { action } = await req.json().catch(() => ({ action: 'restart' }));
    
    if (action === 'restart') {
      console.log('🔄 Manual backup scheduler restart requested');
      
      // Stop existing scheduler
      const backupManager = GlobalBackupManager.getInstance();
      await backupManager.stopGlobalBackupScheduler();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restart scheduler
      await initializeBackupScheduler();
      
      const status = backupManager.getStatus();
      
      return NextResponse.json({
        success: true,
        message: 'Backup scheduler restarted',
        status
      });
    } else if (action === 'status') {
      const backupManager = GlobalBackupManager.getInstance();
      const status = backupManager.getStatus();
      
      return NextResponse.json({
        success: true,
        status
      });
    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "restart" or "status"'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in backup restart endpoint:', error);
    return NextResponse.json({
      error: 'Failed to restart backup scheduler',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
