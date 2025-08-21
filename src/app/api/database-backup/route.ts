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

    const userId = session.user.id;
    const backupService = new DatabaseBackupService(userId);
    
    console.log(`🔄 Manual backup requested for user: ${userId}`);
    
    const result = await backupService.createDatabaseBackup();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Database backup created successfully',
        backupId: result.backupId
      });
    } else {
      return NextResponse.json({
        error: result.error || 'Failed to create backup'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in backup API:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const backupService = new DatabaseBackupService(userId);
    
    const backups = await backupService.listAvailableBackups();
    
    return NextResponse.json({
      backups: backups.map(backup => ({
        backupId: backup.backupId,
        createdAt: backup.createdAt,
        totalDocuments: backup.totalDocuments,
        collections: backup.collections,
        fileName: backup.fileName
      }))
    });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
