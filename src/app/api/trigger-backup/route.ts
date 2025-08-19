import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { DatabaseBackupService, GlobalBackupManager } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { type } = await req.json().catch(() => ({ type: 'user' }));
    
    if (type === 'global') {
      // Trigger global backup for all users (admin function)
      console.log('🔄 Manual global backup triggered');
      const backupManager = GlobalBackupManager.getInstance();
      await backupManager.performGlobalBackup();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Global backup triggered successfully' 
      });
    } else {
      // Trigger backup for current user only
      const userId = session.user.id;
      console.log(`🔄 Manual backup triggered for user: ${userId}`);
      
      const backupService = new DatabaseBackupService(userId);
      const result = await backupService.createDatabaseBackup();
      
      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          backupId: result.backupId,
          message: 'Backup created successfully' 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: result.error || 'Backup failed' 
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error in manual backup trigger:', error);
    return NextResponse.json({ 
      message: 'Failed to trigger backup' 
    }, { status: 500 });
  }
}
