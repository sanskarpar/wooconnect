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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debug logging
  console.log('DatabaseBackupManager - isGoogleDriveConnected:', isGoogleDriveConnected);

  useEffect(() => {
    if (isGoogleDriveConnected) {
      loadBackups();
    }
  }, [isGoogleDriveConnected]);

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
        // Reload backups list
        await loadBackups();
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

  if (!isGoogleDriveConnected) {
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
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-3 p-2 bg-yellow-100 text-xs text-yellow-800">
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/backup-status');
                    const data = await res.json();
                    console.log('Backup status API response:', data);
                    
                    const driveRes = await fetch('/api/google-drive/auth-status');
                    const driveData = await driveRes.json();
                    console.log('Google Drive status API response:', driveData);
                  } catch (error) {
                    console.error('Error testing APIs:', error);
                  }
                }}
                className="mt-1 px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs mr-2"
              >
                Test APIs
              </button>
              
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/debug-collections');
                    const data = await res.json();
                    console.log('Collections debug data:', data);
                    alert('Check console for collection debug data');
                  } catch (error) {
                    console.error('Error debugging collections:', error);
                  }
                }}
                className="mt-1 px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs"
              >
                Debug Collections
              </button>
            </div>
          )}
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
          </div>
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
        </div>
        <div className="flex items-center gap-2 text-green-700">
          <Clock className="h-4 w-4" />
          <p className="text-sm">
            Your database is automatically backed up every 30 minutes. The 5 most recent backups are kept, older ones are automatically deleted.
          </p>
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
