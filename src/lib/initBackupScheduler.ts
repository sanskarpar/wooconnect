import { backupScheduler } from '@/lib/simpleBackupService';

export async function initializeBackupScheduler(): Promise<void> {
  try {
    console.log('🚀 Initializing simple backup scheduler...');
    await backupScheduler.start();
    console.log('✅ Simple backup scheduler initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize backup scheduler:', error);
    throw error;
  }
}
