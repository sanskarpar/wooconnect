// Simplified shim kept for compatibility. Scheduler is started in serverStartup directly.
export async function initializeBackupScheduler() {
  return;
}

export async function forceRestartBackupScheduler() {
  return { success: true, message: 'No-op in simplified scheduler' };
}
