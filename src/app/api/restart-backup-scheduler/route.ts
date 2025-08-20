import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { globalBackupManager } from '@/lib/databaseBackupService';

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
      console.log('🔄 Manual backup scheduler restart requested by user:', session.user.id);
      
      // Stop current scheduler
      await globalBackupManager.stopGlobalBackupScheduler();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start fresh
      await globalBackupManager.startGlobalBackupScheduler();
      
      return NextResponse.json({
        success: true,
        message: 'Backup scheduler restarted successfully'
      });
    } else if (action === 'status') {
      const status = globalBackupManager.getStatus();
      
      return NextResponse.json({
        success: true,
        status
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in backup scheduler operation:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to perform backup scheduler operation'
    }, { status: 500 });
  }
}