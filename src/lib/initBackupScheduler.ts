import { globalBackupManager } from '@/lib/databaseBackupService';

// Global flag to prevent multiple initializations
let globalBackupManagerInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 5; // Increased to 5 attempts

export async function initializeBackupScheduler() {
  // If already initialized and running, don't do anything
  const status = globalBackupManager.getStatus();
  if (status.running) {
    console.log('✅ Backup scheduler already running');
    globalBackupManagerInitialized = true;
    return;
  }
  
  // If we hit max attempts, log but still allow another try (resetting attempts)
  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.log(`⚠️ Max initialization attempts (${MAX_INIT_ATTEMPTS}) reached for backup scheduler, resetting counter`);
    initializationAttempts = 0;
  }

  initializationAttempts++;

  try {
    console.log(`🚀 [Attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS}] Initializing global backup scheduler...`);
    
    // Stop any existing scheduler to avoid duplicate intervals
    await globalBackupManager.stopGlobalBackupScheduler();
    
    // Check if it's initializing
    if (status.initializing) {
      console.log('⏳ Backup scheduler already initializing, waiting...');
      
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      return initializeBackupScheduler();
    }
    
    // Start the global backup scheduler
    await globalBackupManager.startGlobalBackupScheduler();
    
    globalBackupManagerInitialized = true;
    console.log('✅ Global backup scheduler initialized successfully');
    
    // Log the current status
    const backupStatus = await globalBackupManager.getBackupStatus();
    console.log(`📋 Backup status: Next backup in ${backupStatus.minutesUntilNext} minutes`);
    
  } catch (error) {
    console.error(`❌ [Attempt ${initializationAttempts}] Failed to initialize backup scheduler:`, error);
    
    if (initializationAttempts < MAX_INIT_ATTEMPTS) {
      console.log(`⏳ Will retry initialization in 5 seconds...`);
      setTimeout(() => {
        initializeBackupScheduler();
      }, 5000);
    } else {
      console.error('💥 All initialization attempts failed for backup scheduler');
      // Reset counter for future attempts
      initializationAttempts = 0;
    }
  }
}

// Force restart function for manual use
export async function forceRestartBackupScheduler() {
  console.log('🔄 Force restarting backup scheduler...');
  
  try {
    // Stop current scheduler
    await globalBackupManager.stopGlobalBackupScheduler();
    
    // Reset initialization flag
    globalBackupManagerInitialized = false;
    initializationAttempts = 0;
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start fresh
    await initializeBackupScheduler();
    
    console.log('✅ Backup scheduler force restart completed');
    
    // Return success status
    return { success: true, message: 'Backup scheduler restarted successfully' };
  } catch (error) {
    console.error('❌ Error force restarting backup scheduler:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
