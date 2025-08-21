import { initializeBackupScheduler } from '@/lib/initBackupScheduler';
import { globalBackupManager } from '@/lib/databaseBackupService';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Initializing backup scheduler...');
  
  // Function to start backup scheduler with retries
  const startBackupSchedulerWithRetries = async (attempt = 1, maxAttempts = 5) => {
    try {
      console.log(`🔄 Backup scheduler initialization attempt ${attempt}/${maxAttempts}`);
      await initializeBackupScheduler();
      console.log('✅ Server startup: Backup scheduler initialized successfully');
      
      // Check if backup is needed immediately
      try {
        const needsBackup = await globalBackupManager.isBackupNeeded();
        if (needsBackup) {
          console.log('⚡ Server startup: Backup needed - running now');
          await globalBackupManager.performGlobalBackup();
          console.log('✅ Initial backup completed successfully');
        } else {
          const minutesLeft = await globalBackupManager.getTimeUntilNextBackup();
          console.log(`✓ Server startup: No immediate backup needed. Next backup in ${minutesLeft} minutes.`);
        }
      } catch (backupError) {
        console.error('❌ Failed to check/run initial backup:', backupError);
      }
      
    } catch (error) {
      console.error(`❌ Server startup: Failed to initialize backup scheduler (attempt ${attempt}):`, error);
      
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
        console.log(`🔄 Retrying backup scheduler initialization in ${delay}ms...`);
        setTimeout(() => {
          startBackupSchedulerWithRetries(attempt + 1, maxAttempts);
        }, delay);
      } else {
        console.error('❌ All backup scheduler initialization attempts failed');
      }
    }
  };

  // Start immediately
  startBackupSchedulerWithRetries();
  
  // Also set a delayed initialization to ensure it stays running
  setTimeout(() => {
    console.log('🔄 Running delayed backup scheduler check...');
    const status = globalBackupManager.getStatus();
    if (!status.running) {
      console.log('⚠️ Delayed check: Backup scheduler not running - starting...');
      startBackupSchedulerWithRetries();
    } else {
      console.log('✅ Delayed check: Backup scheduler is running');
    }
  }, 30000); // 30 seconds delay
  
  // Set additional periodic health checks to ensure the scheduler keeps running
  setInterval(() => {
    // Check if the scheduler is running
    const status = globalBackupManager.getStatus();
    const now = new Date().toLocaleString();
    
    if (!status.running) {
      console.log(`⚠️ Periodic check (${now}): Backup scheduler not running - restarting...`);
      startBackupSchedulerWithRetries();
    } else {
      // Log status occasionally
      if (Math.floor(Date.now() / (5 * 60 * 1000)) % 1 === 0) { // Every 5 minutes
        console.log(`✅ Periodic check (${now}): Backup scheduler is running`);
      }
      
      // Also check if backup is needed during periodic check
      globalBackupManager.isBackupNeeded().then((needsBackup) => {
        if (needsBackup) {
          console.log(`⚡ Periodic check (${now}): Backup needed - running now`);
          globalBackupManager.performGlobalBackup().then(() => {
            console.log(`✅ Periodic backup completed at ${new Date().toLocaleString()}`);
          }).catch((error) => {
            console.error(`❌ Periodic backup failed at ${new Date().toLocaleString()}:`, error);
          });
        }
      }).catch((error) => {
        console.error(`❌ Failed to check if backup is needed during periodic check at ${now}:`, error);
      });
    }
  }, 60 * 1000); // Check every 1 minute for maximum reliability
}

export const backupSchedulerInitialized = true;
