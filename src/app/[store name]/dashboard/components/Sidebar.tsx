"use client";
// ...existing code...


interface SidebarProps {
  activeTab: 'dashboard' | 'invoices' | 'orders' | 'products' | 'customers' | 'invoiceSettings' | 'storeSettings';
  onTabChange: (tab: 'dashboard' | 'invoices' | 'orders' | 'products' | 'customers' | 'invoiceSettings' | 'storeSettings') => void;
  unpaidInvoicesCount?: number;
}

import { BarChart3, FileText, ShoppingCart, Package, Users, Settings } from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, unpaidInvoicesCount = 0 }: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">WooConnect</h2>

        <button
          onClick={() => window.location.href = '/dashboard'}
          className="w-full mb-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          ← Back to Main Dashboard
        </button>

        <nav className="space-y-2">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            Dashboard
          </button>

          <button
            onClick={() => onTabChange('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'orders'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ShoppingCart className="h-5 w-5" />
            Orders
          </button>

          <button
            onClick={() => onTabChange('products')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'products'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Package className="h-5 w-5" />
            Products
          </button>

          <button
            type="button"
            onClick={() => onTabChange('customers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'customers'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users className="h-5 w-5" />
            Customers
          </button>

          <button
            onClick={() => onTabChange('invoices')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors relative ${
              activeTab === 'invoices'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="h-5 w-5" />
            Invoices
            {unpaidInvoicesCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unpaidInvoicesCount}
              </span>
            )}
          </button>
          {/* Invoice Settings Tab */}
          <button
            onClick={() => onTabChange('invoiceSettings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'invoiceSettings'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="h-5 w-5" />
            Invoice Settings
          </button>

          {/* Store Settings Tab */}
          <button
            onClick={() => onTabChange('storeSettings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              activeTab === 'storeSettings'
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings className="h-5 w-5" />
            Store Settings
          </button>
        </nav>
      </div>
    </div>
  );
}
