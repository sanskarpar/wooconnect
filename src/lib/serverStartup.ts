// Server startup script - includes database backup system initialization
import { initializeBackupScheduler } from '@/lib/initBackupScheduler';

// This will run on the server when this module is imported
if (typeof window === 'undefined') {
  console.log('🚀 Server startup: Server initialized successfully');
  console.log('🔧 Initializing database backup system...');
  
  // Initialize the backup scheduler
  try {
    initializeBackupScheduler();
    console.log('✅ Database backup system initialized - automatic backups every 30 minutes');
  } catch (error) {
    console.error('❌ Failed to initialize backup system:', error);
  }
}

export const serverInitialized = true;
