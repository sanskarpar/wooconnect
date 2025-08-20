// Database Backup Manager Component
'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Database, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';

interface BackupItem {
  backupId: string;
  createdAt: string;
  totalDocuments: number;
  collections: string[];
  fileName: string;
}

interface BackupManagerProps {
  isGoogleDriveConnected: boolean;
}

export default function DatabaseBackupManager({ isGoogleDriveConnected }: BackupManagerProps) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<{ 
    running: boolean; 
    hasInterval: boolean;
    backupTiming?: {
      isRunning: boolean;
      lastBackupTime: number | null;
      nextBackupTime: number | null;
      minutesUntilNext: number;
      nextBackupFormatted: string | null;
    };
  } | null>(null);
  const [localGoogleDriveStatus, setLocalGoogleDriveStatus] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Use both the prop and local status - if either is true, consider it connected
  const isConnected = isGoogleDriveConnected || localGoogleDriveStatus;

  // Debug logging
  console.log('DatabaseBackupManager - isGoogleDriveConnected:', isGoogleDriveConnected);
  console.log('DatabaseBackupManager - localGoogleDriveStatus:', localGoogleDriveStatus);
  console.log('DatabaseBackupManager - isConnected:', isConnected);

  useEffect(() => {
    // Always check status when component mounts
    checkGoogleDriveStatus();
    checkSchedulerStatus();
    
    if (isConnected) {
      loadBackups();
    }

    // Set up periodic status checking every 15 seconds
    const statusInterval = setInterval(() => {
      checkGoogleDriveStatus();
      checkSchedulerStatus();
    }, 15000);

    // Set up countdown timer that updates every minute
    const countdownInterval = setInterval(() => {
      if (schedulerStatus?.backupTiming?.minutesUntilNext) {
        setCountdown(schedulerStatus.backupTiming.minutesUntilNext);
      }
    }, 60000); // Update every minute

    return () => {
      clearInterval(statusInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  // Also check when the prop changes
  useEffect(() => {
    if (isGoogleDriveConnected) {
      checkGoogleDriveStatus();
      loadBackups();
    }
  }, [isGoogleDriveConnected]);

  const checkGoogleDriveStatus = async () => {
    try {
      console.log('🔍 DatabaseBackupManager: Checking Google Drive status...');
      const response = await fetch('/api/google-drive/auth-status');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 DatabaseBackupManager: Google Drive status response:', data);
        setLocalGoogleDriveStatus(data.isConnected || data.connected || false);
      } else {
        console.log('❌ DatabaseBackupManager: Google Drive status request failed:', response.status);
        setLocalGoogleDriveStatus(false);
      }
    } catch (error) {
      console.error('DatabaseBackupManager: Error checking Google Drive status:', error);
      setLocalGoogleDriveStatus(false);
    }
  };

  const checkSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/backup-scheduler-status');
      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus({
          running: data.backupScheduler.running,
          hasInterval: data.backupScheduler.hasInterval,
          backupTiming: data.backupTiming
        });
        
        // Update countdown from the latest data
        if (data.backupTiming?.minutesUntilNext) {
          setCountdown(data.backupTiming.minutesUntilNext);
        }
      }
    } catch (error) {
      console.error('Error checking scheduler status:', error);
    }
  };

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/database-backup');
      const data = await response.json();
      
      if (response.ok) {
        setBackups(data.backups || []);
      } else {
        console.error('Failed to load backups:', data.error);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will replace all your current data with the backup data.')) {
      return;
    }

    setRestoring(backupId);
    setMessage(null);
    
    try {
      const response = await fetch('/api/database-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backupId }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        // Refresh page after successful restore
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to restore backup' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error restoring backup' });
    } finally {
      setRestoring(null);
    }
  };

  const createManualBackup = async () => {
    setCreatingBackup(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/trigger-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'user' }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: `Manual backup created successfully! Backup ID: ${data.backupId}` });
        // Reload backups list and refresh Google Drive status
        await loadBackups();
        await checkGoogleDriveStatus();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create backup' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error creating backup' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-6 w-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Database Backup & Restore</h2>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              Connect Google Drive to enable automatic database backups and restore functionality.
            </p>
          </div>
          
          {/* Status debugging and refresh - always show */}
          <div className="mt-3 p-2 bg-yellow-100 text-xs text-yellow-800">
            <p>Status Check: Prop={isGoogleDriveConnected ? 'Connected' : 'Not Connected'}, Local={localGoogleDriveStatus ? 'Connected' : 'Not Connected'}</p>
            <div className="mt-2 flex gap-2">
              <button 
                onClick={checkGoogleDriveStatus}
                className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
              >
                Refresh Status
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/refresh-drive-status', { method: 'POST' });
                    const data = await res.json();
                    console.log('🔄 Refresh drive status response:', data);
                    if (data.success) {
                      setLocalGoogleDriveStatus(true);
                      setMessage({ type: 'success', text: 'Connection status refreshed' });
                    }
                  } catch (error) {
                    console.error('Error refreshing drive status:', error);
                  }
                }}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Force Refresh
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/debug-connection');
                    const data = await res.json();
                    console.log('🔍 Connection debug data:', data);
                    alert('Check console for detailed connection info');
                  } catch (error) {
                    console.error('Error getting debug info:', error);
                  }
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Debug Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Database Backup & Restore</h2>
        </div>
      </div>

      {/* Automatic Backup Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-medium text-green-800">Automatic Backups Enabled</h3>
            {schedulerStatus && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                schedulerStatus.running 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {schedulerStatus.running ? 'Scheduler Running' : 'Scheduler Stopped'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={createManualBackup}
              disabled={creatingBackup}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {creatingBackup ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {creatingBackup ? 'Creating...' : 'Create Backup Now'}
            </button>
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/check-backup-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  const data = await response.json();
                  
                  if (data.success) {
                    if (data.wasOverdue) {
                      setMessage({ type: 'success', text: 'Overdue backup triggered successfully!' });
                    } else {
                      setMessage({ type: 'success', text: data.message });
                    }
                    await checkSchedulerStatus();
                  } else {
                    setMessage({ type: 'error', text: data.error || 'Failed to check backup' });
                  }
                } catch (error) {
                  setMessage({ type: 'error', text: 'Failed to check backup status' });
                }
              }}
              className="px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2 text-sm"
            >
              <Clock className="h-4 w-4" />
              Check Backup Now
            </button>
            {schedulerStatus && !schedulerStatus.running && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/restart-backup-scheduler', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'restart' })
                    });
                    if (response.ok) {
                      setMessage({ type: 'success', text: 'Backup scheduler restarted' });
                      await checkSchedulerStatus();
                    }
                  } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to restart scheduler' });
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Restart Scheduler
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-green-700">
          <Clock className="h-4 w-4" />
          <div className="text-sm">
            <p>Your database is automatically backed up every 30 minutes. The 5 most recent backups are kept, older ones are automatically deleted.</p>
            {schedulerStatus?.backupTiming && (
              <div className="mt-2 space-y-1">
                {schedulerStatus.backupTiming.lastBackupTime && (
                  <p className="text-xs text-green-600">
                    Last backup: {new Date(schedulerStatus.backupTiming.lastBackupTime).toLocaleString()}
                  </p>
                )}
                {schedulerStatus.backupTiming.minutesUntilNext !== undefined && (
                  <p className="text-xs text-green-600 font-medium">
                    {schedulerStatus.backupTiming.minutesUntilNext === 0 ? (
                      <span className="text-orange-600">⚡ Backup due now - will run shortly</span>
                    ) : (
                      <>Next backup in: {schedulerStatus.backupTiming.minutesUntilNext} minute{schedulerStatus.backupTiming.minutesUntilNext !== 1 ? 's' : ''}</>
                    )}
                    {schedulerStatus.backupTiming.nextBackupFormatted && schedulerStatus.backupTiming.minutesUntilNext > 0 && (
                      <> ({schedulerStatus.backupTiming.nextBackupFormatted})</>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <p>{message.text}</p>
          </div>
        </div>
      )}

      {/* Backups List */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Available Backups</h3>
        
        {backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No backups available yet.</p>
            <p className="text-sm">Your first automatic backup will be created within 30 minutes, or you can create one now using the button above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.backupId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        Backup {backup.backupId.split('_').pop()}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {formatDate(backup.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => restoreBackup(backup.backupId)}
                    disabled={restoring === backup.backupId}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {restoring === backup.backupId ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {restoring === backup.backupId ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
