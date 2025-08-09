'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Store, Settings, Package, ShoppingCart, Users, BarChart3 } from 'lucide-react';

type Store = {
  id: string;
  name: string;
  url: string;
  status: string;
  connectedAt: string;
  stats: {
    products: number;
    orders: number;
    customers: number;
  };
};

export default function DashboardPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [formData, setFormData] = useState({
    storeName: '',
    storeUrl: '',
    consumerKey: '',
    consumerSecret: ''
  });
  const [errors, setErrors] = useState<{
    storeName?: string;
    storeUrl?: string;
    consumerKey?: string;
    consumerSecret?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStores = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/connect-store');
      if (res.ok) {
        const userStores = await res.json();
        setStores(userStores);
      } else {
        console.error('Failed to fetch stores:', res.statusText);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
    setIsRefreshing(false);
  };

  // Fetch existing stores on component mount
  useEffect(() => {
    fetchStores();
  }, []);

  const validateForm = () => {
    const newErrors: {
      storeName?: string;
      storeUrl?: string;
      consumerKey?: string;
      consumerSecret?: string;
    } = {};

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store name is required';
    }

    if (!formData.storeUrl.trim()) {
      newErrors.storeUrl = 'Store URL is required';
    } else if (!isValidUrl(formData.storeUrl)) {
      newErrors.storeUrl = 'Please enter a valid URL';
    }

    if (!formData.consumerKey.trim()) {
      newErrors.consumerKey = 'Consumer Key is required';
    }

    if (!formData.consumerSecret.trim()) {
      newErrors.consumerSecret = 'Consumer Secret is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string) => {
    try {
      // If no protocol, prepend https:// for validation
      const url = string.match(/^https?:\/\//i) ? string : `https://${string}`;
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleConnect = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsConnecting(true);
    setApiError(null);

    try {
      const res = await fetch('/api/connect-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.storeName,
          url: formData.storeUrl,
          consumerKey: formData.consumerKey,
          consumerSecret: formData.consumerSecret,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setApiError(errorData.message || 'Failed to connect store.');
        setIsConnecting(false);
        return;
      }

      const newStore = await res.json();
      setStores(prev => [...prev, newStore]);
      setShowConnectForm(false);
      setFormData({ storeName: '', storeUrl: '', consumerKey: '', consumerSecret: '' });
    } catch (err) {
      setApiError('Network error. Please try again.');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = (storeId: string) => {
    setStores(prev => prev.filter(store => store.id !== storeId));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">WooCommerce Dashboard</h1>
            <p className="text-gray-600">Manage your connected WooCommerce stores</p>
          </div>
          {stores.length > 0 && (
            <button
              onClick={fetchStores}
              disabled={isRefreshing}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
            >
              {isRefreshing ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Refreshing...
                </span>
              ) : (
                <span>Refresh</span>
              )}
            </button>
          )}
        </div>

        {stores.length === 0 && !showConnectForm ? (
          <div className="bg-white p-12 rounded-xl shadow-sm text-center">
            <Store className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-gray-900">No Stores Connected</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Connect your first WooCommerce store to start managing products, orders, and customers from this dashboard.
            </p>
            <button
              onClick={() => setShowConnectForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Connect Your First Store
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Stores */}
            {stores.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stores.map(store => (
                  <div key={store.id} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{store.name}</h3>
                        <p className="text-sm text-gray-500">{store.url}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Connected</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <Package className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-gray-900">{store.stats.products}</p>
                        <p className="text-xs text-gray-500">Products</p>
                      </div>
                      <div className="text-center">
                        <ShoppingCart className="h-5 w-5 text-green-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-gray-900">{store.stats.orders}</p>
                        <p className="text-xs text-gray-500">Orders</p>
                      </div>
                      <div className="text-center">
                        <Users className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-gray-900">{store.stats.customers}</p>
                        <p className="text-xs text-gray-500">Customers</p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-4">
                      Connected: {formatDate(store.connectedAt)}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 px-3 rounded text-sm transition-colors"
                        onClick={() => window.location.href = `/${encodeURIComponent(store.name)}/dashboard`}
                      >
                        <Settings className="h-4 w-4 inline mr-1" />
                        Manage
                      </button>
                      <button 
                        onClick={() => handleDisconnect(store.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-3 rounded text-sm transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Store Button */}
            {stores.length > 0 && !showConnectForm && (
              <div className="text-center">
                <button
                  onClick={() => setShowConnectForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Connect Another Store
                </button>
              </div>
            )}

            {/* Connection Form */}
            {showConnectForm && (
              <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect WooCommerce Store</h2>
                  <p className="text-gray-600">
                    Enter your store details to establish a connection
                  </p>
                </div>

                <form onSubmit={handleConnect}>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-2">
                        Store Name
                      </label>
                      <input
                        type="text"
                        id="storeName"
                        name="storeName"
                        value={formData.storeName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.storeName ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="My Awesome Store"
                      />
                      {errors.storeName && (
                        <p className="text-red-500 text-sm mt-1">{errors.storeName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700 mb-2">
                        Store URL
                      </label>
                      <input
                        type="url"
                        id="storeUrl"
                        name="storeUrl"
                        value={formData.storeUrl}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.storeUrl ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="https://yourstore.com"
                      />
                      {errors.storeUrl && (
                        <p className="text-red-500 text-sm mt-1">{errors.storeUrl}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="consumerKey" className="block text-sm font-medium text-gray-700 mb-2">
                        Consumer Key
                      </label>
                      <input
                        type="text"
                        id="consumerKey"
                        name="consumerKey"
                        value={formData.consumerKey}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.consumerKey ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="ck_xxxxxxxxxxxxxxxxx"
                      />
                      {errors.consumerKey && (
                        <p className="text-red-500 text-sm mt-1">{errors.consumerKey}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="consumerSecret" className="block text-sm font-medium text-gray-700 mb-2">
                        Consumer Secret
                      </label>
                      <input
                        type="password"
                        id="consumerSecret"
                        name="consumerSecret"
                        value={formData.consumerSecret}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.consumerSecret ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="cs_xxxxxxxxxxxxxxxxx"
                      />
                      {errors.consumerSecret && (
                        <p className="text-red-500 text-sm mt-1">{errors.consumerSecret}</p>
                      )}
                    </div>

                    {apiError && (
                      <div className="text-red-600 text-sm mb-2">{apiError}</div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="text-sm text-blue-700">
                          <p className="font-medium mb-1">How to get your API credentials:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Go to your WordPress admin → WooCommerce → Settings → Advanced → REST API</li>
                            <li>Click "Add key" to create new API credentials</li>
                            <li>Set permissions to "Read/Write" and copy the Consumer Key & Secret</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowConnectForm(false);
                          setFormData({ storeName: '', storeUrl: '', consumerKey: '', consumerSecret: '' });
                          setErrors({});
                        }}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
                        disabled={isConnecting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isConnecting}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                      >
                        {isConnecting ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Connecting...
                          </div>
                        ) : (
                          'Connect Store'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}