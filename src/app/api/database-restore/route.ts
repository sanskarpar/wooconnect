import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { DatabaseBackupService } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupId } = await req.json();
    
    if (!backupId) {
      return NextResponse.json({ error: 'Backup ID is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const backupService = new DatabaseBackupService(userId);
    
    console.log(`🔄 Database restore requested for user: ${userId}, backup: ${backupId}`);
    
    const result = await backupService.restoreFromGoogleDrive(backupId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Database restored successfully. ${result.restored} documents restored.`,
        restored: result.restored
      });
    } else {
      return NextResponse.json({
        error: result.error || 'Failed to restore database'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in restore API:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
