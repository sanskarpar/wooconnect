import { NextResponse } from 'next/server';
import { globalBackupManager } from '@/lib/databaseBackupService';

export async function POST() {
  try {
    await globalBackupManager.performGlobalBackup();
    return NextResponse.json({ success: true, message: 'Backup started' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
