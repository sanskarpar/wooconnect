import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { DatabaseBackupService } from '@/lib/databaseBackupService';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const { backupId } = await req.json();

    if (!backupId || typeof backupId !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Backup ID is required.'
      }, { status: 400 });
    }

    console.log(`🗑️  Delete backup requested by user: ${uid}, backupId: ${backupId}`);

    const backupService = new DatabaseBackupService(uid);
    const result = await backupService.deleteBackup(backupId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Delete backup error:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
