'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Upload, FileText, RefreshCw, Settings, X, Cloud, FolderOpen, FileSpreadsheet, Download, RotateCcw } from 'lucide-react';

interface GoogleDriveConfig {
  folderId?: string;
  spreadsheetId?: string;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export default function GoogleDriveSettings() {
  const [config, setConfig] = useState<GoogleDriveConfig>({
    folderId: '',
    spreadsheetId: '',
    isConnected: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchGoogleDriveConfig();
  }, []);

  const fetchGoogleDriveConfig = async () => {
    try {
      const res = await fetch('/api/google-drive/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || config);
      }
    } catch (error) {
      console.error('Error fetching Google Drive config:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (field: keyof GoogleDriveConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/google-drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to save configuration.' });
        return;
      }

      const data = await res.json();
      setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      setConfig(data.config);
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSaving(false);
  };

  const handleConnectToDrive = async () => {
    try {
      // Use NextAuth Google sign-in instead of custom auth flow
      const { signIn } = await import('next-auth/react');
      const baseUrl = window.location.origin;
      
      // Sign in with Google using NextAuth
      await signIn('google', {
        callbackUrl: `${baseUrl}/dashboard`,
        redirect: true
      });
      
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Google Drive? This will stop automatic uploads.')) {
      return;
    }

    try {
      const res = await fetch('/api/google-drive/disconnect', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to disconnect.' });
        return;
      }

      setConfig(prev => ({ 
        ...prev, 
        isConnected: false, 
        accessToken: undefined, 
        refreshToken: undefined 
      }));
      setMessage({ type: 'success', text: 'Disconnected from Google Drive.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  const handleTestUpload = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/google-drive/test-upload', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Test upload failed.' });
        return;
      }

      const data = await res.json();
      setMessage({ type: 'success', text: `Test upload successful! File uploaded: ${data.fileName}` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setTesting(false);
  };

  const handleDownloadSpreadsheet = async () => {
    setDownloading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/google-drive/download-spreadsheet', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Download failed.' });
        return;
      }

      const data = await res.json();
      
      // Open download URL in new window
      window.open(data.downloadUrl, '_blank');
      setMessage({ type: 'success', text: 'Spreadsheet download started!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setDownloading(false);
  };

  const handleSyncAll = async () => {
    if (!confirm('This will delete ALL current invoices from Google Drive and re-upload them. Are you sure?')) {
      return;
    }

    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/google-drive/sync-all', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Sync failed.' });
        return;
      }

      const data = await res.json();
      setMessage({ 
        type: 'success', 
        text: `Sync completed! ${data.uploadedCount} invoices uploaded successfully.` 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading Google Drive settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Cloud className="h-6 w-6 mr-2 text-blue-500" />
              Google Drive Integration
            </h2>
            <p className="text-gray-600 mt-1">
              Automatically upload invoices to Google Drive and maintain a Google Sheet
            </p>
          </div>
          {config.isConnected && (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Connected</span>
            </div>
          )}
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.type === 'error' 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            <div className="flex items-center">
              {message.type === 'error' ? (
                <AlertCircle className="h-5 w-5 mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* Connection Status & Actions */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Drive Connection</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-2">📌 Integrated Google Authentication</p>
                  <p>Google Drive integration uses your main Google account authentication. Click "Connect to Google Drive" to authorize access to your Google Drive for automatic invoice uploads.</p>
                </div>
              </div>
            </div>
            
            {!config.isConnected ? (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Sign in with your Google account to enable automatic invoice uploads and Google Sheets integration.
                </p>
                <button
                  onClick={handleConnectToDrive}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  Connect to Google Drive
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-green-700 font-medium">
                      Successfully connected to Google Drive
                    </span>
                  </div>
                </div>

                {/* Drive Folder Configuration */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Drive Folder ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={config.folderId || ''}
                      onChange={(e) => handleInputChange('folderId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Leave empty to upload to root folder"
                    />
                    <p className="text-gray-500 text-sm mt-1">
                      Optional: Specify a folder ID to organize invoice uploads
                    </p>
                    {/* Save and Disconnect buttons side by side */}
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="bg-blue-100 hover:bg-blue-200 disabled:bg-blue-50 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center border border-blue-300"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Save Folder Settings
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
               


