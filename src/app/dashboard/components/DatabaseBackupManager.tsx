'use client';
import { useState, useEffect } from 'react';
import { 
  Shield, 
  Download, 
  Upload, 
  Clock, 
  Database, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Trash2,
  Calendar,
  FileText,
  ExternalLink,
  Play
} from 'lucide-react';

interface BackupMetadata {
  _id: string;
  userId: string;
  backupId: string;
  createdAt: string;
  invoiceCount: number;
  fileSize: number;
  driveFileId: string;
  driveFileName: string;
  driveLink: string;
  backupType: 'automatic' | 'manual';
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

interface BackupStats {
  totalBackups: number;
  lastBackupDate: string | null;
  totalInvoicesInLastBackup: number;
  automaticBackups: number;
  manualBackups: number;
}

export default function DatabaseBackupManager() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<{
    isRunning: boolean;
    nextBackupIn?: number;
    backupInterval: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'delete' | 'restore';
    backupId: string;
    backupDate: string;
  } | null>(null);

  // Load backup data on component mount
  useEffect(() => {
    loadBackupData();
    loadSchedulerStatus();
    
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      loadBackupData();
      loadSchedulerStatus();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadBackupData = async () => {
    try {
      const response = await fetch('/api/database-backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
        setStats(data.stats || null);
      } else {
        setError('Failed to load backup data');
      }
    } catch (error) {
      setError('Failed to load backup data');
      console.error('Load backup data error:', error);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/backup-scheduler-status');
      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus(data);
      }
    } catch (error) {
      console.error('Load scheduler status error:', error);
    }
  };

  const createManualBackup = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/database-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        await loadBackupData(); // Refresh the backup list
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to create backup');
      console.error('Create backup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreFromBackup = async (backupId: string) => {
    setLoading(true);
    setError('');
    setMessage('');
    setShowConfirmDialog(null);

    try {
      const response = await fetch('/api/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        // Note: After restoration, the page should probably reload to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to restore backup');
      console.error('Restore backup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    setLoading(true);
    setError('');
    setMessage('');
    setShowConfirmDialog(null);

    try {
      const response = await fetch('/api/delete-backup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        await loadBackupData(); // Refresh the backup list
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to delete backup');
      console.error('Delete backup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const forceBackupNow = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/backup-scheduler-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-backup' })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        await loadBackupData(); // Refresh the backup list
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to force backup');
      console.error('Force backup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeSince = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Database Backup System</h2>
              <p className="text-sm text-gray-600">Automatic invoice backups to Google Drive every 30 minutes</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={createManualBackup}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Create Manual Backup
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Backups</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalBackups || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Last Backup</p>
                <p className="text-sm font-bold text-gray-900">
                  {stats?.lastBackupDate ? getTimeSince(stats.lastBackupDate) : 'Never'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Invoices in Last Backup</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalInvoicesInLastBackup || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <RefreshCw className={`h-8 w-8 mr-3 ${schedulerStatus?.isRunning ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="text-sm font-medium text-gray-600">Auto Backup</p>
                <p className="text-sm font-bold text-gray-900">
                  {schedulerStatus?.isRunning ? 'Running' : 'Stopped'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Backup List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Backup History</h3>
            <span className="text-sm text-gray-500">Maximum 5 backups kept</span>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No backups found</p>
              <p className="text-sm">Create your first backup or connect Google Drive to enable automatic backups</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Backup Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(backup.createdAt)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {getTimeSince(backup.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          backup.backupType === 'automatic' 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {backup.backupType === 'automatic' ? (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Automatic
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3 mr-1" />
                              Manual
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {backup.invoiceCount} invoices
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatFileSize(backup.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          backup.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : backup.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {backup.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {backup.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {backup.status === 'pending' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                          {backup.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {backup.status === 'completed' && (
                          <>
                            <button
                              onClick={() => setShowConfirmDialog({
                                type: 'restore',
                                backupId: backup.backupId,
                                backupDate: backup.createdAt
                              })}
                              className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                              disabled={loading}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              Restore
                            </button>
                            {backup.driveLink && (
                              <a
                                href={backup.driveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900 inline-flex items-center"
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Drive
                              </a>
                            )}
                            <button
                              onClick={() => setShowConfirmDialog({
                                type: 'delete',
                                backupId: backup.backupId,
                                backupDate: backup.createdAt
                              })}
                              className="text-red-600 hover:text-red-900 inline-flex items-center"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              {showConfirmDialog.type === 'restore' ? (
                <Upload className="h-6 w-6 text-blue-600 mr-3" />
              ) : (
                <Trash2 className="h-6 w-6 text-red-600 mr-3" />
              )}
              <h3 className="text-lg font-medium text-gray-900">
                {showConfirmDialog.type === 'restore' ? 'Restore Backup' : 'Delete Backup'}
              </h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              {showConfirmDialog.type === 'restore' 
                ? `Are you sure you want to restore from backup created on ${formatDate(showConfirmDialog.backupDate)}? This will replace all current invoices with the backup data. A safety backup will be created before restoration.`
                : `Are you sure you want to delete the backup created on ${formatDate(showConfirmDialog.backupDate)}? This action cannot be undone.`
              }
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirmDialog.type === 'restore') {
                    restoreFromBackup(showConfirmDialog.backupId);
                  } else {
                    deleteBackup(showConfirmDialog.backupId);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  showConfirmDialog.type === 'restore'
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                } disabled:opacity-50`}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  showConfirmDialog.type === 'restore' ? 'Restore' : 'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
