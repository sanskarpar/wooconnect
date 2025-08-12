"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Save, Trash2, Key, Globe, Shield, Eye, EyeOff } from 'lucide-react';

interface StoreSettings {
  id: string;
  name: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  status: string;
  connectedAt: string;
}

interface StoreSettingsPageProps {
  storeName?: string;
}

export default function StoreSettingsPage({ storeName }: StoreSettingsPageProps) {
  const params = useParams();
  const currentStoreName = storeName || params?.['store name'] as string;
  
  const [settings, setSettings] = useState<StoreSettings>({
    id: '',
    name: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
    status: '',
    connectedAt: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Validation function
  const validateSettings = (settings: StoreSettings): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Required fields (Store name cannot be changed)
    if (!settings.url?.trim()) {
      errors.url = 'Store URL is required';
    } else if (!/^https?:\/\/.+/.test(settings.url)) {
      errors.url = 'Please enter a valid URL (starting with http:// or https://)';
    }
    if (!settings.consumerKey?.trim()) {
      errors.consumerKey = 'Consumer Key is required';
    }
    if (!settings.consumerSecret?.trim()) {
      errors.consumerSecret = 'Consumer Secret is required';
    }
    return errors;
  };

  // Show notification for 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Warn user about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  // Fetch store settings
  useEffect(() => {
    const fetchStoreSettings = async () => {
      if (!currentStoreName) return;
      
      setLoading(true);
      try {
        // First get the store list to find the store
        const res = await fetch('/api/connect-store');
        if (res.ok) {
          const stores: StoreSettings[] = await res.json();
          const store = stores.find(s => 
            s.name.toLowerCase() === decodeURIComponent(currentStoreName).toLowerCase()
          );
          
          if (store) {
            // We need to get the full store data including credentials
            // Since the public API doesn't return credentials, we'll fetch them separately
            const fullStoreRes = await fetch(`/api/store-settings?storeId=${store.id}`);
            if (fullStoreRes.ok) {
              const fullStore = await fullStoreRes.json();
              setSettings(fullStore);
            } else {
              // Fallback to the basic store data and let user re-enter credentials
              setSettings({
                ...store,
                consumerKey: '',
                consumerSecret: ''
              });
            }
          } else {
            setNotification({ type: 'error', message: 'Store not found' });
          }
        } else {
          setNotification({ type: 'error', message: 'Failed to fetch store settings' });
        }
      } catch (error) {
        console.error('Error fetching store settings:', error);
        setNotification({ type: 'error', message: 'Failed to fetch store settings' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchStoreSettings();
  }, [currentStoreName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Prevent changing store name
    if (name === 'name') return;
    setSettings(prev => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const testConnection = async () => {
    const validationErrors = validateSettings(settings);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setNotification({ type: 'error', message: 'Please fix validation errors before testing connection' });
      return;
    }

    setTestingConnection(true);
    try {
      // Test the connection by making a simple API call to the WooCommerce store
      const testUrl = `${settings.url.replace(/\/$/, '')}/wp-json/wc/v3/system_status`;
      const testApiUrl = new URL(testUrl);
      testApiUrl.searchParams.append('consumer_key', settings.consumerKey);
      testApiUrl.searchParams.append('consumer_secret', settings.consumerSecret);

      const response = await fetch(testApiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'WooConnect/1.0'
        }
      });

      if (response.ok) {
        setNotification({ type: 'success', message: 'Connection test successful! ✅' });
      } else {
        setNotification({ type: 'error', message: `Connection test failed: ${response.status} ${response.statusText}` });
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setNotification({ type: 'error', message: 'Connection test failed. Please check your settings.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    // Validate settings before saving
    const validationErrors = validateSettings(settings);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      setNotification({ type: 'error', message: 'Please fix the validation errors before saving.' });
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch('/api/store-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: settings.id,
          name: settings.name.trim(),
          url: settings.url.trim(),
          consumerKey: settings.consumerKey.trim(),
          consumerSecret: settings.consumerSecret.trim()
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }
      
      const updatedStore = await res.json();
      setSettings(updatedStore);
      setErrors({});
      setNotification({ type: 'success', message: 'Store settings saved successfully! 🎉' });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save error:', error);
      setNotification({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/store-settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: settings.id }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete store');
      }
      
      setNotification({ type: 'success', message: 'Store deleted successfully!' });
      
      // Redirect to main dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (error) {
      console.error('Delete error:', error);
      setNotification({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to delete store' 
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading store settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Settings</h1>
          <p className="text-gray-600">
            Manage your WooCommerce store connection and settings
          </p>
        </div>

        {/* Main Settings Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="space-y-8">
            {/* Store Information Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900">Store Information</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={settings.name}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                    placeholder="My WooCommerce Store"
                  />
                </div>

                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                    Store URL *
                  </label>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    value={settings.url}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.url ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="https://your-store.com"
                  />
                  {errors.url && (
                    <p className="mt-1 text-sm text-red-600">{errors.url}</p>
                  )}
                </div>
              </div>
            </div>

            {/* API Credentials Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-5 w-5 text-green-500" />
                <h2 className="text-xl font-semibold text-gray-900">API Credentials</h2>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How to get your WooCommerce API keys:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Go to your WooCommerce admin → WooCommerce → Settings → Advanced → REST API</li>
                      <li>Click "Add Key" and create a new API key with Read/Write permissions</li>
                      <li>Copy the Consumer Key and Consumer Secret</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="consumerKey" className="block text-sm font-medium text-gray-700 mb-2">
                    Consumer Key *
                  </label>
                  <input
                    type="text"
                    id="consumerKey"
                    name="consumerKey"
                    value={settings.consumerKey}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                      errors.consumerKey ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  {errors.consumerKey && (
                    <p className="mt-1 text-sm text-red-600">{errors.consumerKey}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="consumerSecret" className="block text-sm font-medium text-gray-700 mb-2">
                    Consumer Secret *
                  </label>
                  <div className="relative">
                    <input
                      type={showConsumerSecret ? "text" : "password"}
                      id="consumerSecret"
                      name="consumerSecret"
                      value={settings.consumerSecret}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                        errors.consumerSecret ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConsumerSecret(!showConsumerSecret)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConsumerSecret ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.consumerSecret && (
                    <p className="mt-1 text-sm text-red-600">{errors.consumerSecret}</p>
                  )}
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  {testingConnection ? 'Testing Connection...' : 'Test Connection'}
                </button>
              </div>
            </div>

            {/* Store Status */}
            {settings.connectedAt && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Connection Status</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      settings.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="font-medium capitalize">{settings.status}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Connected on: {formatDate(settings.connectedAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Store
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Are you sure? This cannot be undone.</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-600">You have unsaved changes</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || Object.keys(errors).length > 0}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Keyboard shortcuts: <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+S</kbd> to save
          </p>
        </div>
      </div>
    </div>
  );
}
