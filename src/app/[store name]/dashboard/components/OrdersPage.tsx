"use client";
import React, { useEffect, useState } from 'react';

type Order = {
  id: string;
  date: string;
  customer: string;
  total: number;
  status: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
};

interface OrdersPageProps {
  storeName: string;
}

export default function OrdersPage({ storeName }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'other'>('all');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching orders for store:', storeName);
        // Replace with your actual API endpoint
        const res = await fetch(`/api/${encodeURIComponent(storeName)}/orders`);
        console.log('Orders API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('Orders data received:', data);
          setOrders(data.orders || []);
        } else {
          const errorText = await res.text();
          console.error('Orders API error:', res.status, errorText);
          setError('Failed to fetch orders.');
        }
      } catch (err) {
        console.error('Orders fetch error:', err);
        setError('Failed to fetch orders.');
      }
      setLoading(false);
    };
    fetchOrders();
  }, [storeName]);

  const filteredOrders = orders.filter(order =>
    filter === 'all'
      ? true
      : filter === 'other'
      ? order.status !== 'completed' && order.status !== 'pending'
      : order.status === filter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <span>✅</span>;
      case 'pending':
        return <span>⏳</span>;
      default:
        return <span>🕒</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading orders...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage orders for {storeName}</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'completed', 'pending', 'other'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-1">
                  ({orders.filter(order =>
                    status === 'other'
                      ? order.status !== 'completed' && order.status !== 'pending'
                      : order.status === status
                  ).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-500 text-xl">🧾</span>
            <span className="text-sm font-medium text-blue-700">Total Orders</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-500 text-xl">✅</span>
            <span className="text-sm font-medium text-green-700">Completed</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {orders.filter(order => order.status === 'completed').length}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-500 text-xl">⏳</span>
            <span className="text-sm font-medium text-yellow-700">Pending</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {orders.filter(order => order.status === 'pending').length}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-500 text-xl">🕒</span>
            <span className="text-sm font-medium text-gray-700">Other</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {orders.filter(order => order.status !== 'completed' && order.status !== 'pending').length}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-700">{order.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(order.date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{order.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700">${order.total.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.items && order.items.length > 0 ? (
                      <div className="text-xs text-gray-500">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        <ul className="list-disc pl-4 space-y-1 mt-1">
                          {order.items.map((item, idx) => (
                            <li key={idx} className="text-xs text-gray-700">
                              <span className="font-semibold text-gray-900">{item.name}</span> <span className="text-xs">x{item.quantity}</span> <span className="text-green-600 font-medium">(${item.price.toFixed(2)})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No items</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <span className="text-6xl text-gray-400 mx-auto mb-4">🧾</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No orders have been created yet.'
              : `No ${filter} orders found.`
            }
          </p>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-lg font-semibold mt-6 text-center">{error}</div>
      )}
    </div>
  );
}
