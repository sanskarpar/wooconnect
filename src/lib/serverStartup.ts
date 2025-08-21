import { globalBackupManager } from '@/lib/databaseBackupService';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Starting backup scheduler...');
  globalBackupManager.startGlobalBackupScheduler()
    .then(() => console.log('✅ Backup scheduler started'))
    .catch((e) => console.error('❌ Failed to start backup scheduler', e));
}

export const backupSchedulerInitialized = true;
