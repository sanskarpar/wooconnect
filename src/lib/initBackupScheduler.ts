import { GlobalBackupManager } from '@/lib/databaseBackupService';

// Global flag to prevent multiple initializations across the entire application
let globalBackupManagerInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

export async function initializeBackupScheduler() {
  if (globalBackupManagerInitialized) {
    console.log('Backup scheduler already initialized globally');
    return;
  }

  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.log(`Max initialization attempts (${MAX_INIT_ATTEMPTS}) reached for backup scheduler`);
    return;
  }

  initializationAttempts++;

  try {
    console.log(`Initializing global backup scheduler (attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS})...`);
    const backupManager = GlobalBackupManager.getInstance();
    
    // Check if it's already running
    const status = backupManager.getStatus();
    if (status.running) {
      console.log('Backup scheduler already running');
      globalBackupManagerInitialized = true;
      return;
    }

    if (status.initializing) {
      console.log('Backup scheduler already initializing');
      return;
    }
    
    await backupManager.startGlobalBackupScheduler();
    globalBackupManagerInitialized = true;
    console.log('Global backup scheduler initialized successfully');
    
    // Reset attempt counter on success
    initializationAttempts = 0;
  } catch (error) {
    console.error(`Failed to initialize backup scheduler (attempt ${initializationAttempts}):`, error);
    
    // Retry with exponential backoff if we haven't reached max attempts
    if (initializationAttempts < MAX_INIT_ATTEMPTS) {
      const delay = Math.pow(2, initializationAttempts) * 5000; // 5s, 10s, 20s
      console.log(`Retrying backup scheduler initialization in ${delay}ms...`);
      setTimeout(() => {
        initializeBackupScheduler();
      }, delay);
    }
  }
}

// Auto-initialize when this module is imported (server-side only)
if (typeof window === 'undefined') {
  // Only run on server side
  console.log('Server-side backup scheduler auto-initialization starting...');
  initializeBackupScheduler();
}
