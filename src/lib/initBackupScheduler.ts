import { createAutomaticBackupsForAllUsers } from '@/lib/databaseBackupService';

// Global variable to store the interval ID
let backupInterval: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

/**
 * Initialize the backup scheduler
 * This will create automatic backups every 30 minutes for all users with Google Drive connected
 */
export function initializeBackupScheduler(): void {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return;
  }

  // Prevent multiple schedulers from running
  if (isSchedulerRunning) {
    console.log('⚠️  Backup scheduler is already running');
    return;
  }

  console.log('🚀 Initializing automatic backup scheduler...');
  
  try {
    // Clear any existing interval
    if (backupInterval) {
      clearInterval(backupInterval);
    }

    // Run initial backup after a short delay to ensure server is fully started
    setTimeout(async () => {
      try {
        console.log('🔄 Running initial automatic backup...');
        await createAutomaticBackupsForAllUsers();
      } catch (error) {
        console.error('Failed to run initial backup:', error);
      }
    }, 5000); // 5 second delay

    // Set up recurring backup every 30 minutes (1800000 ms)
    backupInterval = setInterval(async () => {
      try {
        console.log(`🕒 Running scheduled automatic backup at ${new Date().toISOString()}`);
        await createAutomaticBackupsForAllUsers();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds

    isSchedulerRunning = true;
    console.log('✅ Backup scheduler initialized successfully - backups will run every 30 minutes');
    
  } catch (error) {
    console.error('Failed to initialize backup scheduler:', error);
    isSchedulerRunning = false;
  }
}

/**
 * Stop the backup scheduler
 */
export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    isSchedulerRunning = false;
    console.log('🛑 Backup scheduler stopped');
  }
}

/**
 * Get the current status of the backup scheduler
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  intervalId: NodeJS.Timeout | null;
  nextBackupIn?: number; // milliseconds until next backup
} {
  return {
    isRunning: isSchedulerRunning,
    intervalId: backupInterval,
    nextBackupIn: isSchedulerRunning ? 30 * 60 * 1000 : undefined // Always 30 minutes for this simple implementation
  };
}

/**
 * Force run a backup cycle now (for testing/manual trigger)
 */
export async function forceBackupNow(): Promise<void> {
  console.log('🔥 Force running backup cycle...');
  try {
    await createAutomaticBackupsForAllUsers();
    console.log('✅ Force backup completed');
  } catch (error) {
    console.error('Force backup failed:', error);
    throw error;
  }
}

// Auto-initialize the scheduler when this module is imported (server-side only)
if (typeof window === 'undefined') {
  // Add a small delay to ensure the server is fully started
  setTimeout(() => {
    initializeBackupScheduler();
  }, 2000);
}