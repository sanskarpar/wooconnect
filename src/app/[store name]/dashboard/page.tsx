"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Package, ShoppingCart, Users, BarChart3, AlertTriangle, RefreshCw, FileText, DollarSign } from 'lucide-react';
import Sidebar from './components/Sidebar';
import InvoiceSettingsPage from './components/InvoiceSettingsPage';
import InvoicesPage from './components/InvoicesPage';
import OrdersPage from './components/OrdersPage';
import ProductsPage from './components/ProductsPage';
import CustomersPage from './components/Customers';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts';

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
    revenue?: number;
    invoices?: number;
    monthlyRevenue?: { month: string; revenue: number }[];
    topProducts?: { name: string; sales: number }[];
  };
  syncStatus?: 'success' | 'failed' | 'syncing';
  syncFailureReason?: string;
  consumerKey?: string;
};

export default function StoreDashboardPage() {
  const params = useParams();
  const storeName = params?.['store name'];
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'orders' | 'products' | 'customers' | 'invoiceSettings'>('dashboard');
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);
  const [alerts, setAlerts] = useState([
    { type: 'warning', message: '2 unpaid invoices.' }
  ]);

  // Use real data from store.stats if available
  // Helper to get last 6 months labels
  function getLast6Months() {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
    }
    return months;
  }

  // Merge backend data with zeroes for missing months
  const last6Months = getLast6Months();
  const monthlyRevenueMap = new Map(
    (store?.stats?.monthlyRevenue || []).map((item) => [item.month, item.revenue])
  );
  const revenueData = last6Months.map((month) => ({
    month,
    revenue: monthlyRevenueMap.get(month) || 0
  }));

  const topProductsData = store?.stats?.topProducts && Array.isArray(store.stats.topProducts) && store.stats.topProducts.length > 0
    ? store.stats.topProducts
    : [
        { name: 'No Data', sales: 0 }
      ];

  useEffect(() => {
    const fetchStore = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/connect-store');
        if (res.ok) {
          const stores: Store[] = await res.json();
          const found = stores.find(
            s => s.name.toLowerCase() === decodeURIComponent(storeName as string).toLowerCase()
          );
          setStore(found || null);
        }
      } catch {
        setStore(null);
      }
      setLoading(false);
    };
    if (storeName) fetchStore();
  }, [storeName]);

  // Fetch invoices and count unpaid
  useEffect(() => {
    const fetchUnpaidInvoices = async () => {
      if (!store?.name) return;
      try {
        const res = await fetch(`/api/${encodeURIComponent(store.name)}/invoices`);
        if (res.ok) {
          const data = await res.json();
          const unpaidCount = Array.isArray(data.invoices)
            ? data.invoices.filter((inv: any) => inv.status === 'unpaid').length
            : 0;
          setUnpaidInvoicesCount(unpaidCount);
          setAlerts(
            unpaidCount > 0
              ? [{ type: 'warning', message: `${unpaidCount} unpaid invoice${unpaidCount > 1 ? 's' : ''}.` }]
              : []
          );
        } else {
          setUnpaidInvoicesCount(0);
          setAlerts([]);
        }
      } catch {
        setUnpaidInvoicesCount(0);
        setAlerts([]);
      }
    };
    if (store?.name) fetchUnpaidInvoices();
  }, [store?.name]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-xl w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Store not found
          </h1>
          <p className="text-gray-600">Could not find a store named <span className="font-semibold">{storeName ? decodeURIComponent(storeName as string) : ''}</span>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        unpaidInvoicesCount={unpaidInvoicesCount}
      />
      
      <div className="flex-1 p-8">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-6xl mx-auto">
          {activeTab === 'dashboard' ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
                {store.name} Dashboard
              </h1>
              <p className="text-gray-600 mb-4 text-center">
                Welcome to the dashboard for <span className="font-semibold">{store.name}</span>.
              </p>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="mb-4">
                  {alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded mb-1 text-sm ${
                        alert.type === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Sync Status with detailed failure reason */}
              <div className="flex items-center gap-2 mb-6">
                <RefreshCw
                  className={`h-4 w-4 ${
                    store.syncStatus === 'syncing'
                      ? 'animate-spin text-blue-500'
                      : store.syncStatus === 'failed'
                      ? 'text-red-500'
                      : 'text-green-500'
                  }`}
                />
                <span className="text-xs">
                  {store.syncStatus === 'syncing'
                    ? 'Syncing...'
                    : store.syncStatus === 'failed'
                    ? `Sync failed: ${store.syncFailureReason || 'Unknown error'}`
                    : 'Synced'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 flex flex-col items-center">
                  <ShoppingCart className="h-6 w-6 text-blue-500 mb-1" />
                  <div className="text-xl font-bold">{store.stats.orders}</div>
                  <div className="text-xs text-gray-500">Orders</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 flex flex-col items-center">
                  <FileText className="h-6 w-6 text-green-500 mb-1" />
                  <div className="text-xl font-bold">{store.stats.invoices ?? '-'}</div>
                  <div className="text-xs text-gray-500">Invoices</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 flex flex-col items-center">
                  <DollarSign className="h-6 w-6 text-yellow-500 mb-1" />
                  <div className="text-xl font-bold">
                    {typeof store.stats.revenue === 'number'
                      ? `$${store.stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '-'}
                  </div>
                  <div className="text-xs text-gray-500">Revenue</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 flex flex-col items-center">
                  <Users className="h-6 w-6 text-purple-500 mb-1" />
                  <div className="text-xl font-bold">{store.stats.customers}</div>
                  <div className="text-xs text-gray-500">Customers</div>
                </div>
              </div>

              {/* Top Products & Revenue Graphs (placeholders) */}
              <div className="mb-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold text-gray-700">Revenue Over Time</span>
                  </div>
                  <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-gray-700">Top Products</span>
                  </div>
                  <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={topProductsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sales" fill="#34d399" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Connection info */}
              <div className="text-xs text-gray-500 mb-2 text-center">
                Connected: {formatDate(store.connectedAt)}
              </div>
              <div className="text-xs text-gray-500 text-center">
                Store URL: <a href={store.url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{store.url}</a>
              </div>
            </>
          ) : activeTab === 'invoices' ? (
            <InvoicesPage storeName={store.name} />
          ) : activeTab === 'orders' ? (
            <OrdersPage storeName={store.name} />
          ) : activeTab === 'products' ? (
            <ProductsPage storeName={store.name} />
          ) : activeTab === 'customers' ? (
            <CustomersPage storeName={store.name} />
          ) : activeTab === 'invoiceSettings' ? (
            <InvoiceSettingsPage />
          ) : null}
        </div>
      </div>
    </div>
  );
}
