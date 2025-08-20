import { globalBackupManager } from '@/lib/databaseBackupService';

// Global flag to prevent multiple initializations
let globalBackupManagerInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

export async function initializeBackupScheduler() {
  if (globalBackupManagerInitialized) {
    console.log('✅ Backup scheduler already initialized globally');
    return;
  }

  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.log(`❌ Max initialization attempts (${MAX_INIT_ATTEMPTS}) reached for backup scheduler`);
    return;
  }

  initializationAttempts++;

  try {
    console.log(`🚀 [Attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS}] Initializing global backup scheduler...`);
    
    // Check if it's already running
    const status = globalBackupManager.getStatus();
    if (status.running) {
      console.log('✅ Backup scheduler already running');
      globalBackupManagerInitialized = true;
      return;
    }

    if (status.initializing) {
      console.log('⏳ Backup scheduler already initializing, waiting...');
      return;
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
  } catch (error) {
    console.error('❌ Error force restarting backup scheduler:', error);
  }
}
