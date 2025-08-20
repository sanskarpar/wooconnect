import { initializeBackupScheduler } from '@/lib/initBackupScheduler';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Initializing backup scheduler...');
  
  // Initialize backup scheduler immediately
  initializeBackupScheduler().then(() => {
    console.log('✅ Server startup: Backup scheduler initialized');
    
    // Additional step: Check if backup is needed right now
    globalBackupManager.isBackupNeeded().then((needsBackup) => {
      if (needsBackup) {
        console.log('⚡ Server startup: Backup needed - running now');
        globalBackupManager.performGlobalBackup().then(() => {
          console.log('✅ Initial backup completed successfully');
        }).catch((error) => {
          console.error('❌ Initial backup failed:', error);
        });
      } else {
        console.log('✓ Server startup: No immediate backup needed');
      }
    }).catch((error) => {
      console.error('❌ Failed to check if backup is needed:', error);
    });
  }).catch((error) => {
    console.error('❌ Server startup: Failed to initialize backup scheduler:', error);
  });
  
  // Also set a delayed initialization to ensure it stays running
  setTimeout(() => {
    initializeBackupScheduler().then(() => {
      console.log('✅ Delayed backup scheduler initialization completed');
    }).catch((error) => {
      console.error('❌ Delayed backup scheduler initialization failed:', error);
    });
  }, 10000); // 10 seconds delay
  
  // Set additional periodic checks to ensure the scheduler keeps running
  setInterval(() => {
    initializeBackupScheduler().then(() => {
      console.log('✅ Periodic backup scheduler check completed');
      
      // Also check if backup is needed during periodic check
      globalBackupManager.isBackupNeeded().then((needsBackup) => {
        if (needsBackup) {
          console.log('⚡ Periodic check: Backup needed - running now');
          globalBackupManager.performGlobalBackup().catch((error) => {
            console.error('❌ Periodic backup failed:', error);
          });
        }
      }).catch((error) => {
        console.error('❌ Failed to check if backup is needed during periodic check:', error);
      });
    }).catch((error) => {
      console.error('❌ Periodic backup scheduler check failed:', error);
    });
  }, 3 * 60 * 1000); // Check every 3 minutes (more frequent checks)
}

export const backupSchedulerInitialized = true;
