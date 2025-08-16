'use client';
import { useState, useEffect } from 'react';
// Types for jsPDF and jsPDF-AutoTable
// @ts-ignore
import type { jsPDF } from 'jspdf';
// @ts-ignore
import type autoTable from 'jspdf-autotable';
import { CheckCircle, AlertCircle, Store, Settings, Package, ShoppingCart, Users, BarChart3, FileText, Download, Search, Filter, ChevronDown, Plus, RefreshCw, Cloud } from 'lucide-react';
import { downloadInvoicePDF, type InvoiceData } from '@/lib/invoicePdfGenerator';
import UniversalInvoiceSettings from './components/UniversalInvoiceSettings';
import GoogleDriveSettings from './components/GoogleDriveSettings';
import BlacklistManager from './components/BlacklistManager';
import { applyBlacklistFilter } from '@/lib/blacklistFilter';
import { BlacklistSettings } from '@/app/api/invoice-blacklist/route';

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
  const [activeTab, setActiveTab] = useState<'invoices' | 'settings' | 'google-drive' | 'blacklist'>('invoices');
  const [blacklistSettings, setBlacklistSettings] = useState<BlacklistSettings>({
    enabled: false,
    rules: [],
    logExcludedInvoices: false
  });
  const [excludedInvoicesCount, setExcludedInvoicesCount] = useState(0);
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isWooSyncing, setIsWooSyncing] = useState(false);
  const [wooSyncMessage, setWooSyncMessage] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

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
  const currencySymbol = '€';

  // Edit mode states
  const [editModeEnabled, setEditModeEnabled] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<UniversalInvoice | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const syncAllInvoices = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Call the new sync-all endpoint to re-upload everything to Google Drive
      const res = await fetch('/api/google-drive/sync-all', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMessage(`✅ ${data.message}`);
        // Refresh invoices after sync
        await fetchUniversalInvoices();
      } else {
        const errorData = await res.json();
        setSyncMessage(`❌ Sync failed: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error syncing invoices:', error);
      setSyncMessage('❌ Sync failed: Network error');
    }
    setIsSyncing(false);
    
    // Clear sync message after 5 seconds
    setTimeout(() => setSyncMessage(null), 5000);
  };

  // Sync invoices from WooCommerce into universalInvoices collection
  const syncWooInvoices = async () => {
    // Avoid concurrent Woo syncs
    if (isWooSyncing) return;
    setIsWooSyncing(true);
    setWooSyncMessage(null);
    try {
      const res = await fetch('/api/sync-invoices', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWooSyncMessage(`✅ ${data.message}`);
        // Refresh the universal invoices list after sync
        await fetchUniversalInvoices();
      } else {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        setWooSyncMessage(`❌ Woo sync failed: ${errorData.message}`);
      }
    } catch (err) {
      console.error('Error syncing Woo invoices:', err);
      setWooSyncMessage('❌ Woo sync failed: Network error');
    }
    setIsWooSyncing(false);
    // Clear message after a short delay
    setTimeout(() => setWooSyncMessage(null), 5000);
  };

  const downloadAllPDFs = async () => {
    setIsDownloading(true);
    setDownloadMessage(null);
    try {
      const res = await fetch('/api/download-all-pdfs', {
        method: 'POST',
      });
      if (res.ok) {
        // Create a blob from the response
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = url;
        link.download = `All_Invoices_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        window.URL.revokeObjectURL(url);
        
        setDownloadMessage('✅ All PDFs downloaded successfully!');
      } else {
        const errorData = await res.json();
        setDownloadMessage(`❌ Download failed: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error downloading PDFs:', error);
      setDownloadMessage('❌ Download failed: Network error');
    }
    setIsDownloading(false);
    
    // Clear download message after 5 seconds
    setTimeout(() => setDownloadMessage(null), 5000);
  };

  const migrateOldInvoices = async () => {
    setIsMigrating(true);
    setMigrationMessage(null);
    try {
      const res = await fetch('/api/migrate-invoices', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setMigrationMessage(data.message);
        // Refresh invoices after migration
        await fetchUniversalInvoices();
      } else {
        const errorData = await res.json();
        setMigrationMessage(`Migration failed: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error migrating invoices:', error);
      setMigrationMessage('Migration failed: Network error');
    }
    setIsMigrating(false);
    
    // Clear migration message after 5 seconds
    setTimeout(() => setMigrationMessage(null), 5000);
  };

  // Fetch existing stores on component mount
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await fetchStores();
      setLoading(false);
      
      // Run initial sync if there are stores but we want to make sure 
      // all invoices are properly saved with universal IDs
      setTimeout(() => {
        // This will be triggered by the stores useEffect when stores are loaded
      }, 500);
    };
    initData();
  }, []);

  // Fetch invoices when stores change and run sync if needed
  useEffect(() => {
    if (stores.length > 0) {
      // First fetch existing saved invoices
      fetchUniversalInvoices();
      
      // Then run a background sync to ensure all invoices are saved
      // Only if we're not already syncing
      if (!isSyncing) {
        setTimeout(() => {
          // Only sync if we're not already syncing and have stores
          if (!isSyncing && stores.length > 0) {
            // Ensure WooCommerce invoices are synced into the universal collection first
            syncWooInvoices();
            syncAllInvoices();
          }
        }, 2000); // Increased delay to avoid conflicts
      }
    } else {
      setInvoices([]);
    }
  }, [stores.length]); // Changed dependency to only trigger when store count changes

  // Fetch universal invoice settings
  useEffect(() => {
    fetch('/api/universal-invoice-settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      });
  }, []);

  // Fetch blacklist settings
  useEffect(() => {
    fetch('/api/invoice-blacklist')
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          setBlacklistSettings(data.settings);
        }
      })
      .catch(error => {
        console.error('Error fetching blacklist settings:', error);
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
      
      // Trigger a sync for the new store after a short delay: sync WooCommerce orders first so invoices exist,
      // then run Google Drive sync to upload PDFs if needed.
      setTimeout(() => {
        syncWooInvoices();
        syncAllInvoices();
      }, 2000);
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

  // Handle Universal Invoice System text clicks for edit mode activation
  const handleUniversalInvoiceSystemClick = () => {
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount === 4) {
        setEditModeEnabled(true);
        setTimeout(() => setClickCount(0), 2000); // Reset after 2 seconds
        return 0;
      }
      return newCount;
    });
    
    // Reset click count after 3 seconds if not reached 4
    setTimeout(() => {
      setClickCount(prev => prev > 0 ? 0 : prev);
    }, 3000);
  };

  // Start editing an invoice
  const startEditingInvoice = (invoice: UniversalInvoice) => {
    setEditingInvoice(invoice.id);
    // Deep copy the invoice to avoid reference issues
    setEditFormData({
      ...invoice,
      billingAddress: invoice.billingAddress ? { ...invoice.billingAddress } : {},
      items: invoice.items ? [...invoice.items] : []
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingInvoice(null);
    setEditFormData(null);
  };

  // Handle edit form changes
  const handleEditFormChange = (field: string, value: any) => {
    if (!editFormData) return;
    
    if (field.startsWith('billingAddress.')) {
      const addressField = field.split('.')[1];
      setEditFormData(prev => prev ? {
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [addressField]: value
        }
      } : null);
    } else if (field.startsWith('items.')) {
      const [, indexStr, itemField] = field.split('.');
      const index = parseInt(indexStr);
      setEditFormData(prev => prev ? {
        ...prev,
        items: prev.items?.map((item, i) => 
          i === index ? { ...item, [itemField]: value } : item
        ) || []
      } : null);
    } else {
      setEditFormData(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  // Add new item to invoice being edited
  const addEditItem = () => {
    if (!editFormData) return;
    setEditFormData(prev => prev ? {
      ...prev,
      items: [...(prev.items || []), { name: '', quantity: 1, price: 0 }]
    } : null);
  };

  // Remove item from invoice being edited
  const removeEditItem = (index: number) => {
    if (!editFormData) return;
    setEditFormData(prev => prev ? {
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    } : null);
  };

  // Save edited invoice
  const saveEditedInvoice = async () => {
    if (!editFormData || !editingInvoice) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/universal-invoices/${editingInvoice}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed to update invoice: ${errorData.message}`);
        return;
      }

      // Refresh invoices to show updated data
      await fetchUniversalInvoices();
      
      // Exit edit mode
      cancelEditing();
      
      // Show success message
      alert('Invoice updated successfully!');
      
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Network error. Please try again.');
    }
    setIsUpdating(false);
  };

  // Delete invoice
  const deleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/universal-invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed to delete invoice: ${errorData.message}`);
        return;
      }

      // Refresh invoices to remove deleted invoice
      await fetchUniversalInvoices();
      
      // Show success message
      alert('Invoice deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Network error. Please try again.');
    }
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
  const baseFilteredInvoices = invoices.filter(invoice => {
    const matchesStore = selectedStore === 'all' || invoice.storeName === selectedStore;
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      invoice.universalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.storeInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStore && matchesStatus && matchesSearch;
  });

  // Apply blacklist filtering
  const { filteredInvoices, excludedInvoices } = applyBlacklistFilter(baseFilteredInvoices, blacklistSettings);
  
  // Update excluded count when filtering changes
  useEffect(() => {
    setExcludedInvoicesCount(excludedInvoices.length);
  }, [excludedInvoices.length]);

  // Handle blacklist settings updates
  const handleBlacklistSettingsChange = (newSettings: BlacklistSettings) => {
    setBlacklistSettings(newSettings);
  };

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
          <p
            className="text-sm text-gray-600"
            onClick={handleUniversalInvoiceSystemClick}
          >
            Universal Invoice System
            {editModeEnabled && <span className="ml-2 text-green-600">✓ Edit Mode</span>}
          </p>
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
            {/* All Stores row - bigger */}
            <button
              onClick={() => setSelectedStore('all')}
              className={`w-full text-left px-4 py-4 rounded-xl transition-colors ${
                selectedStore === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              style={{ fontSize: '1.15rem', fontWeight: 600 }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">All Stores</span>
                <span className="text-base text-gray-500">{invoices.length}</span>
              </div>
            </button>

            {/* Individual stores - smaller */}
            {stores.map(store => {
              const storeInvoiceCount = invoices.filter(inv => inv.storeName === store.name).length;
              return (
                <div key={store.id} className="mb-2">
                  <button
                    onClick={() => setSelectedStore(store.name)}
                    className={`w-full text-left px-2 py-2 rounded-lg transition-colors ${
                      selectedStore === store.name
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    style={{ fontSize: '0.95rem' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium truncate">{store.name}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                          Connected
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{storeInvoiceCount}</span>
                    </div>
                  </button>
                  {/* View Store button below store name */}
                  <button
                    onClick={() => window.location.href = `/${encodeURIComponent(store.name)}/dashboard`}
                    className="w-full text-left px-2 py-1 mt-1 text-blue-600 hover:text-blue-800 text-xs rounded-lg transition-colors"
                    style={{ fontSize: '0.85rem' }}
                  >
                    View Store
                  </button>
                </div>
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
              <div className="text-lg font-bold text-green-700">{currencySymbol}{paidAmount.toFixed(2)}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-sm text-yellow-600">Unpaid</div>
              <div className="text-lg font-bold text-yellow-700">{currencySymbol}{unpaidAmount.toFixed(2)}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600">Overdue</div>
              <div className="text-lg font-bold text-red-700">{currencySymbol}{overdueAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Universal Invoice System */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Universal Dashboard</h1>
              <p className="text-gray-600">
                Manage your universal invoice system and settings
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {activeTab === 'invoices' && (
                <>
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
                  <button
                    onClick={syncAllInvoices}
                    disabled={isSyncing || isRefreshing || invoicesLoading}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync All'}
                  </button>
                  <button
                    onClick={downloadAllPDFs}
                    disabled={isDownloading}
                    className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                  >
                    <Download className={`h-4 w-4 mr-2 ${isDownloading ? 'animate-pulse' : ''}`} />
                    {isDownloading ? 'Downloading...' : 'Download All PDFs'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Universal Invoices
                </div>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Universal Settings
                </div>
              </button>
              <button
                onClick={() => setActiveTab('google-drive')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'google-drive'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Cloud className="h-4 w-4 mr-2" />
                  Google Drive
                </div>
              </button>
              <button
                onClick={() => setActiveTab('blacklist')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'blacklist'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Blacklist
                  {excludedInvoicesCount > 0 && (
                    <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {excludedInvoicesCount}
                    </span>
                  )}
                </div>
              </button>
            </nav>
          </div>

          {/* Sync Status Message */}
          {syncMessage && (
            <div className={`p-3 rounded-lg mt-4 ${
              syncMessage.includes('failed') || syncMessage.includes('error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {syncMessage}
            </div>
          )}

          {/* Migration Status Message */}
          {migrationMessage && (
            <div className={`p-3 rounded-lg mt-4 ${
              migrationMessage.includes('failed') || migrationMessage.includes('error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {migrationMessage}
            </div>
          )}

          {/* Download Status Message */}
          {downloadMessage && (
            <div className={`p-3 rounded-lg mt-4 ${
              downloadMessage.includes('failed') || downloadMessage.includes('error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {downloadMessage}
            </div>
          )}

          {/* Blacklist Status Message */}
          {blacklistSettings.enabled && excludedInvoicesCount > 0 && activeTab === 'invoices' && (
            <div className="p-3 rounded-lg mt-4 bg-yellow-50 text-yellow-800 border border-yellow-200">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <span>
                  {excludedInvoicesCount} invoice{excludedInvoicesCount !== 1 ? 's' : ''} hidden by blacklist rules. 
                  <button 
                    onClick={() => setActiveTab('blacklist')}
                    className="ml-1 font-medium underline hover:no-underline"
                  >
                    Manage rules
                  </button>
                </span>
              </div>
            </div>
          )}

          {/* Tab Content Headers */}
          {activeTab === 'invoices' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Universal Invoices</h2>
                  <p className="text-gray-600">
                    {selectedStore === 'all' 
                      ? `All invoices across ${stores.length} connected stores`
                      : `Invoices from ${selectedStore}`
                    }
                  </p>
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
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'invoices' ? (
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
                            <div className="text-sm font-medium text-gray-900">{currencySymbol}{invoice.amount.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2 justify-center">
                              <button
                                className="text-blue-600 hover:text-blue-900"
                                onClick={async () => {
                                  try {
                                    const invoiceData = convertUniversalInvoiceToInvoiceData(invoice);
                                    const pdfBytes = await downloadInvoicePDF(invoiceData, settings || {}, invoice.storeName);
                                    // Create a Blob and trigger download
                                    const arrayBuffer = pdfBytes instanceof ArrayBuffer ? pdfBytes : pdfBytes.buffer;
                                    const blob = new Blob([new Uint8Array(arrayBuffer as ArrayBuffer)], { type: 'application/pdf' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${invoice.storeInvoiceNumber || 'invoice'}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(() => {
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    }, 100);
                                  } catch (error) {
                                    console.error('Error generating PDF:', error);
                                    alert('Error generating PDF. Please try again.');
                                  }
                                }}
                                title="Download PDF"
                              >
                                <Download className="h-5 w-5" />
                              </button>
                              {editModeEnabled && (
                                <>
                                  <button
                                    className="text-yellow-600 hover:text-yellow-900"
                                    onClick={() => startEditingInvoice(invoice)}
                                    title="Edit invoice details"
                                  >
                                    <Settings className="h-5 w-5" />
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-900"
                                    onClick={() => deleteInvoice(invoice.id)}
                                    title="Delete invoice"
                                  >
                                    <AlertCircle className="h-5 w-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'settings' ? (
          <div className="flex-1 overflow-auto p-6">
            <UniversalInvoiceSettings 
              onSettingsUpdate={(newSettings: any) => setSettings(newSettings)}
            />
          </div>
        ) : activeTab === 'google-drive' ? (
          <div className="flex-1 overflow-auto p-6">
            <GoogleDriveSettings />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6">
            <BlacklistManager onSettingsChange={handleBlacklistSettingsChange} />
          </div>
        )}
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

      {/* Edit Invoice Details Modal */}
      {editingInvoice && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Invoice Details</h2>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Invoice Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Universal Invoice Number
                    </label>
                    <input
                      type="text"
                      value={editFormData.universalNumber}
                      onChange={(e) => handleEditFormChange('universalNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Invoice Number
                    </label>
                    <input
                      type="text"
                      value={editFormData.storeInvoiceNumber}
                      onChange={(e) => handleEditFormChange('storeInvoiceNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.storeName}
                      onChange={(e) => handleEditFormChange('storeName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.amount}
                      onChange={(e) => handleEditFormChange('amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => handleEditFormChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <input
                      type="text"
                      value={editFormData.paymentMethod || ''}
                      onChange={(e) => handleEditFormChange('paymentMethod', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Customer Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.customerName}
                        onChange={(e) => handleEditFormChange('customerName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Email
                      </label>
                      <input
                        type="email"
                        value={editFormData.customerEmail || ''}
                        onChange={(e) => handleEditFormChange('customerEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Billing Address</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 1
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.address_1 || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.address_1', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.address_2 || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.address_2', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.city || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State/Province
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.state || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.state', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postcode
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.postcode || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.postcode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          value={editFormData.billingAddress?.country || ''}
                          onChange={(e) => handleEditFormChange('billingAddress.country', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Invoice Items</h3>
                    <button
                      type="button"
                      onClick={addEditItem}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editFormData.items?.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={item.name}
                          onChange={(e) => handleEditFormChange(`items.${index}.name`, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleEditFormChange(`items.${index}.quantity`, parseInt(e.target.value) || 1)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="1"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={item.price}
                          onChange={(e) => handleEditFormChange(`items.${index}.price`, parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeEditItem(index)}
                          className="text-red-500 hover:text-red-700"
                          disabled={(editFormData.items?.length || 0) === 1}
                        >
                          <AlertCircle className="h-5 w-5" />
                        </button>
                      </div>
                    )) || []}
                  </div>
                </div>

                {/* Dates */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Dates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Created Date
                      </label>
                      <input
                        type="datetime-local"
                        value={editFormData.createdAt ? new Date(editFormData.createdAt).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleEditFormChange('createdAt', new Date(e.target.value).toISOString())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date
                      </label>
                      <input
                        type="datetime-local"
                        value={editFormData.dueDate ? new Date(editFormData.dueDate).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleEditFormChange('dueDate', new Date(e.target.value).toISOString())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedInvoice}
                  disabled={isUpdating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isUpdating ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Saving...
                    </div>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
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