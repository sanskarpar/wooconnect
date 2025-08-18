import { GlobalBackupManager } from '@/lib/databaseBackupService';

// Global flag to prevent multiple initializations across the entire application
let globalBackupManagerInitialized = false;

export async function initializeBackupScheduler() {
  if (globalBackupManagerInitialized) {
    console.log('Backup scheduler already initialized globally');
    return;
  }

  try {
    console.log('Initializing global backup scheduler...');
    const backupManager = GlobalBackupManager.getInstance();
    
    // Check if it's already running
    const status = backupManager.getStatus();
    if (status.running || status.initializing) {
      console.log('Backup scheduler already running or initializing');
      globalBackupManagerInitialized = true;
      return;
    }
    
    await backupManager.startGlobalBackupScheduler();
    globalBackupManagerInitialized = true;
    console.log('Global backup scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize backup scheduler:', error);
  }
}

// Auto-initialize when this module is imported (server-side only)
if (typeof window === 'undefined') {
  // Only run on server side
  initializeBackupScheduler();
}
