import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { DatabaseBackupService } from '@/lib/databaseBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    console.log(`📦 Manual backup requested by user: ${uid}`);

    const backupService = new DatabaseBackupService(uid);
    const result = await backupService.createManualBackup();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        backupId: result.backupId,
        driveLink: result.driveLink
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Manual backup error:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const backupService = new DatabaseBackupService(uid);
    
    const backups = await backupService.getBackupList();
    const stats = await backupService.getBackupStats();

    return NextResponse.json({
      backups,
      stats
    });

  } catch (error) {
    console.error('Get backups error:', error);
    return NextResponse.json({
      message: `Failed to get backups: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
