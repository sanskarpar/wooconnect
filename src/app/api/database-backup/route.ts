import { NextRequest, NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';
import clientPromise from '@/lib/mongodb';

export async function POST() {
  try {
    await globalBackupManager.performGlobalBackup();
    return NextResponse.json({ success: true, message: 'Backup started' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const status = await globalBackupManager.getBackupStatus();
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const backups = await db.collection('databaseBackups')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return NextResponse.json({
      status,
      recentBackups: backups.map(b => ({
        backupId: b.backupId,
        createdAt: b.createdAt,
        totalDocuments: b.totalDocuments,
        fileName: b.fileName
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
