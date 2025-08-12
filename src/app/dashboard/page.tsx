'use client';
import { useState, useEffect } from 'react';
// Types for jsPDF and jsPDF-AutoTable
// @ts-ignore
import type { jsPDF } from 'jspdf';
// @ts-ignore
import type autoTable from 'jspdf-autotable';
import { CheckCircle, AlertCircle, Store, Settings, Package, ShoppingCart, Users, BarChart3, FileText, Download, Search, Filter, ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { downloadInvoicePDF, type InvoiceData } from '@/lib/invoicePdfGenerator';

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

interface UniversalInvoice {
  id: string;
  universalNumber: string;
  storeInvoiceNumber: string;
  storeName: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;
  orderStatus?: string;
  paymentMethod?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  billingAddress?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export default function DashboardPage() {
  // Helper to sort invoices by universalNumber (e.g., '2025-01', '2025-02', ...)
  function sortInvoicesByUniversalNumber(invoices: UniversalInvoice[]) {
    return [...invoices].sort((a, b) => {
      const [yearA, numA] = a.universalNumber.split('-');
      const [yearB, numB] = b.universalNumber.split('-');
      if (yearA !== yearB) return yearB.localeCompare(yearA);
      return parseInt(numB) - parseInt(numA);
    });
  }
  const [stores, setStores] = useState<Store[]>([]);
  const [invoices, setInvoices] = useState<UniversalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [settings, setSettings] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
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

  // Add Invoice form state
  const [showAddInvoiceForm, setShowAddInvoiceForm] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    storeName: '',
    customerName: '',
    customerEmail: '',
    amount: '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    items: [{ name: '', quantity: 1, price: 0 }],
    billingAddress: {
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      postcode: '',
      country: ''
    }
  });
  const [invoiceErrors, setInvoiceErrors] = useState<{
    storeName?: string;
    customerName?: string;
    amount?: string;
    dueDate?: string;
  }>({});
  const [invoiceApiError, setInvoiceApiError] = useState<string | null>(null);

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

  const fetchUniversalInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const res = await fetch('/api/universal-invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      } else {
        console.error('Failed to fetch universal invoices:', res.statusText);
      }
    } catch (error) {
      console.error('Error fetching universal invoices:', error);
    }
    setInvoicesLoading(false);
  };

  // Fetch existing stores on component mount
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await fetchStores();
      setLoading(false);
    };
    initData();
  }, []);

  // Fetch invoices when stores change
  useEffect(() => {
    if (stores.length > 0) {
      fetchUniversalInvoices();
    } else {
      setInvoices([]);
    }
  }, [stores]);

  // Fetch invoice settings
  useEffect(() => {
    fetch('/api/invoice-settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      });
  }, []);

  // Convert universal invoice to InvoiceData format
  const convertUniversalInvoiceToInvoiceData = (universalInvoice: UniversalInvoice): InvoiceData => {
    return {
      id: universalInvoice.id,
      number: universalInvoice.storeInvoiceNumber,
      universalNumber: universalInvoice.universalNumber,
      amount: universalInvoice.amount,
      status: universalInvoice.status,
      customerName: universalInvoice.customerName,
      customerEmail: universalInvoice.customerEmail,
      createdAt: universalInvoice.createdAt,
      dueDate: universalInvoice.dueDate,
      orderStatus: universalInvoice.orderStatus,
      paymentMethod: universalInvoice.paymentMethod,
      items: universalInvoice.items,
      customerAddress: universalInvoice.billingAddress
    };
  };

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

  // Invoice form validation
  const validateInvoiceForm = () => {
    const newErrors: {
      storeName?: string;
      customerName?: string;
      amount?: string;
      dueDate?: string;
    } = {};

    if (!invoiceFormData.storeName.trim()) {
      newErrors.storeName = 'Store name is required';
    }

    if (!invoiceFormData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!invoiceFormData.amount || parseFloat(invoiceFormData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (!invoiceFormData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    setInvoiceErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInvoiceInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('billingAddress.')) {
      const field = name.split('.')[1];
      setInvoiceFormData(prev => ({
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [field]: value
        }
      }));
    } else {
      setInvoiceFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when user starts typing
    if (invoiceErrors[name as keyof typeof invoiceErrors]) {
      setInvoiceErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setInvoiceFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateInvoiceForm()) return;

    setIsCreatingInvoice(true);
    setInvoiceApiError(null);

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: invoiceFormData.storeName,
          customerName: invoiceFormData.customerName,
          customerEmail: invoiceFormData.customerEmail,
          amount: parseFloat(invoiceFormData.amount),
          dueDate: new Date(invoiceFormData.dueDate).toISOString(),
          items: invoiceFormData.items.filter(item => item.name.trim() !== ''),
          billingAddress: invoiceFormData.billingAddress
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setInvoiceApiError(errorData.message || 'Failed to create invoice.');
        setIsCreatingInvoice(false);
        return;
      }

      const newInvoice = await res.json();
      
      // Refresh invoices to get the updated list
      await fetchUniversalInvoices();
      
      setShowAddInvoiceForm(false);
      setInvoiceFormData({
        storeName: '',
        customerName: '',
        customerEmail: '',
        amount: '',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ name: '', quantity: 1, price: 0 }],
        billingAddress: {
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: ''
        }
      });
    } catch (err) {
      setInvoiceApiError('Network error. Please try again.');
    }
    setIsCreatingInvoice(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'unpaid':
        return <AlertCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Filter invoices based on selected store and status
  const filteredInvoices = invoices.filter(invoice => {
    const matchesStore = selectedStore === 'all' || invoice.storeName === selectedStore;
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      invoice.universalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.storeInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStore && matchesStatus && matchesSearch;
  });

  // Calculate totals
  const totalInvoices = filteredInvoices.length;
  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidAmount = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidAmount = filteredInvoices.filter(inv => inv.status === 'unpaid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueAmount = filteredInvoices.filter(inv => inv.status === 'overdue').reduce((sum, invoice) => sum + invoice.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (stores.length === 0 && !showConnectForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white p-12 rounded-xl shadow-sm text-center">
            <Store className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-gray-900">No Stores Connected</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Connect your first WooCommerce store to start managing universal invoices across all your stores.
            </p>
            <button
              onClick={() => setShowConnectForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Connect Your First Store
            </button>
          </div>

          {/* Connection Form */}
          {showConnectForm && (
            <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl mx-auto mt-8">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Left Sidebar - Connected Stores */}
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">WooConnect</h1>
          <p className="text-sm text-gray-600">Universal Invoice System</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Connected Stores</h2>
            <button
              onClick={() => setShowConnectForm(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Add Store"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Store Filter Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => setSelectedStore('all')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedStore === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">All Stores</span>
                <span className="text-sm text-gray-500">{invoices.length}</span>
              </div>
            </button>

            {stores.map(store => {
              const storeInvoiceCount = invoices.filter(inv => inv.storeName === store.name).length;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedStore === store.name
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium truncate">{store.name}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                        Connected
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{storeInvoiceCount}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Store Management */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                fetchStores();
                fetchUniversalInvoices();
              }}
              disabled={isRefreshing || invoicesLoading}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || invoicesLoading) ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              onClick={() => setShowConnectForm(true)}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Store
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="p-4 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">Total Invoices</div>
              <div className="text-xl font-bold text-gray-900">{totalInvoices}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600">Paid</div>
              <div className="text-lg font-bold text-green-700">£{paidAmount.toFixed(2)}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-sm text-yellow-600">Unpaid</div>
              <div className="text-lg font-bold text-yellow-700">£{unpaidAmount.toFixed(2)}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600">Overdue</div>
              <div className="text-lg font-bold text-red-700">£{overdueAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Universal Invoice System */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Universal Invoices</h1>
              <p className="text-gray-600">
                {selectedStore === 'all' 
                  ? `All invoices across ${stores.length} connected stores`
                  : `Invoices from ${selectedStore}`
                }
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAddInvoiceForm(true)}
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Invoice
              </button>
              <button
                onClick={() => {
                  fetchStores();
                  fetchUniversalInvoices();
                }}
                disabled={isRefreshing || invoicesLoading}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || invoicesLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'unpaid' | 'overdue')}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="flex-1 overflow-auto p-6">
          {invoicesLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading invoices...</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invoices Found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== 'all' || selectedStore !== 'all'
                    ? 'Try adjusting your filters or search term.'
                    : 'No invoices available from your connected stores.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Universal Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Store Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Store
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      {/* Status column removed */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      {/* Due Date column removed */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortInvoicesByUniversalNumber(filteredInvoices).map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{invoice.universalNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{invoice.storeInvoiceNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{invoice.storeName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{invoice.customerName}</div>
                          {invoice.customerEmail && (
                            <div className="text-sm text-gray-500">{invoice.customerEmail}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">£{invoice.amount.toFixed(2)}</div>
                        </td>
                        {/* Status cell removed */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.createdAt)}
                        </td>
                        {/* Due Date cell removed */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            onClick={async () => {
                              try {
                                const invoiceData = convertUniversalInvoiceToInvoiceData(invoice);
                                await downloadInvoicePDF(invoiceData, settings || {}, invoice.storeName);
                              } catch (error) {
                                console.error('Error generating PDF:', error);
                                alert('Error generating PDF. Please try again.');
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => window.location.href = `/${encodeURIComponent(invoice.storeName)}/dashboard`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View Store
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Form Modal */}
      {showConnectForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Add Invoice Form Modal */}
      {showAddInvoiceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateInvoice} className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Invoice</h2>
                <button
                  type="button"
                  onClick={() => setShowAddInvoiceForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {invoiceApiError && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {invoiceApiError}
                </div>
              )}

              <div className="space-y-4">
                {/* Store Name */}
                <div>
                  <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">
                    Store Name *
                  </label>
                  {stores.length > 0 ? (
                    <select
                      id="storeName"
                      name="storeName"
                      value={invoiceFormData.storeName}
                      onChange={handleInvoiceInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        invoiceErrors.storeName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    >
                      <option value="">Select a store</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.name}>{store.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="storeName"
                      name="storeName"
                      value={invoiceFormData.storeName}
                      onChange={handleInvoiceInputChange}
                      placeholder="Enter store name"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        invoiceErrors.storeName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                  )}
                  {invoiceErrors.storeName && (
                    <p className="text-red-500 text-sm mt-1">{invoiceErrors.storeName}</p>
                  )}
                </div>

                {/* Customer Name */}
                <div>
                  <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    id="customerName"
                    name="customerName"
                    value={invoiceFormData.customerName}
                    onChange={handleInvoiceInputChange}
                    placeholder="Enter customer name"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      invoiceErrors.customerName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {invoiceErrors.customerName && (
                    <p className="text-red-500 text-sm mt-1">{invoiceErrors.customerName}</p>
                  )}
                </div>

                {/* Customer Email */}
                <div>
                  <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    id="customerEmail"
                    name="customerEmail"
                    value={invoiceFormData.customerEmail}
                    onChange={handleInvoiceInputChange}
                    placeholder="Enter customer email (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Billing Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Address
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="billingAddress.address_1"
                      value={invoiceFormData.billingAddress.address_1}
                      onChange={handleInvoiceInputChange}
                      placeholder="Address Line 1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="billingAddress.address_2"
                      value={invoiceFormData.billingAddress.address_2}
                      onChange={handleInvoiceInputChange}
                      placeholder="Address Line 2 (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        name="billingAddress.city"
                        value={invoiceFormData.billingAddress.city}
                        onChange={handleInvoiceInputChange}
                        placeholder="City"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="billingAddress.postcode"
                        value={invoiceFormData.billingAddress.postcode}
                        onChange={handleInvoiceInputChange}
                        placeholder="Postcode"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        name="billingAddress.state"
                        value={invoiceFormData.billingAddress.state}
                        onChange={handleInvoiceInputChange}
                        placeholder="State/Province"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="billingAddress.country"
                        value={invoiceFormData.billingAddress.country}
                        onChange={handleInvoiceInputChange}
                        placeholder="Country"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="amount"
                    name="amount"
                    value={invoiceFormData.amount}
                    onChange={handleInvoiceInputChange}
                    placeholder="0.00"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      invoiceErrors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {invoiceErrors.amount && (
                    <p className="text-red-500 text-sm mt-1">{invoiceErrors.amount}</p>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    id="dueDate"
                    name="dueDate"
                    value={invoiceFormData.dueDate}
                    onChange={handleInvoiceInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      invoiceErrors.dueDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {invoiceErrors.dueDate && (
                    <p className="text-red-500 text-sm mt-1">{invoiceErrors.dueDate}</p>
                  )}
                </div>

                {/* Items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Items
                  </label>
                  {invoiceFormData.items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={invoiceFormData.items.length === 1}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </button>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInvoiceForm(false);
                    setInvoiceFormData({
                      storeName: '',
                      customerName: '',
                      customerEmail: '',
                      amount: '',
                      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      items: [{ name: '', quantity: 1, price: 0 }],
                      billingAddress: {
                        address_1: '',
                        address_2: '',
                        city: '',
                        state: '',
                        postcode: '',
                        country: ''
                      }
                    });
                    setInvoiceErrors({});
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
                  disabled={isCreatingInvoice}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingInvoice}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isCreatingInvoice ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create Invoice'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}