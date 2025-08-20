import { initializeBackupScheduler } from '@/lib/initBackupScheduler';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Initializing backup scheduler...');
  
  // Initialize backup scheduler immediately
  initializeBackupScheduler().then(() => {
    console.log('✅ Server startup: Backup scheduler initialized');
  }).catch((error) => {
    console.error('❌ Server startup: Failed to initialize backup scheduler:', error);
  });
  
  // Also set a delayed initialization in case the first one fails
  setTimeout(() => {
    initializeBackupScheduler().then(() => {
      console.log('✅ Delayed backup scheduler initialization completed');
    }).catch((error) => {
      console.error('❌ Delayed backup scheduler initialization failed:', error);
    });
  }, 10000); // 10 seconds delay
}

export const backupSchedulerInitialized = true;
