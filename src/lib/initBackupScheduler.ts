import { globalBackupManager } from '@/lib/databaseBackupService';

let globalBackupManagerInitialized = false;

export async function initializeBackupScheduler() {
  // If already initialized and running, don't do anything
  const status = globalBackupManager.getStatus();
  if (status.running) {
    console.log('✅ Backup scheduler already running');
    globalBackupManagerInitialized = true;
    return;
  }

  if (globalBackupManagerInitialized) {
    console.log('✅ Backup scheduler already initialized');
    return;
  }

  try {
    console.log('🚀 Initializing backup scheduler...');
    
    // Stop any existing scheduler to avoid duplicates
    await globalBackupManager.stopGlobalBackupScheduler();
    
    // Start the backup scheduler
    await globalBackupManager.startGlobalBackupScheduler();
    
    globalBackupManagerInitialized = true;
    console.log('✅ Backup scheduler initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing backup scheduler:', error);
    throw error;
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
