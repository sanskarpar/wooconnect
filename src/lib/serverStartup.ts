import { initializeBackupScheduler } from '@/lib/initBackupScheduler';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Initializing backup scheduler...');
  
  // Simple initialization - no complex retry logic
  const initializeBackup = async () => {
    try {
      await initializeBackupScheduler();
      console.log('✅ Server startup: Backup scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Server startup: Failed to initialize backup scheduler:', error);
    }
  };

  // Start immediately
  initializeBackup();
}

export const backupSchedulerInitialized = true;
