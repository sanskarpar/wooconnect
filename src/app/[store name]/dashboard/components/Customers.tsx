"use client";
import { useEffect, useState } from "react";
import { Users, Mail, Phone, Loader2, AlertTriangle } from "lucide-react";

interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  date_created: string;
  orders_count?: number;
  total_spent?: string;
  avatar_url?: string;
  billing?: {
    phone?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface CustomersPageProps {
  storeName: string;
}

export default function CustomersPage({ storeName }: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all stores to get credentials for the selected store
        const res = await fetch("/api/connect-store");
        if (!res.ok) throw new Error("Failed to fetch store info");
        const stores = await res.json();
        const store = stores.find(
          (s: any) => s.name.toLowerCase() === storeName.toLowerCase()
        );
        if (!store) throw new Error("Store not found");

        // Call a custom API route to fetch customers for this store
        // You should implement /api/[store name]/customers/route.ts to proxy WooCommerce API
        const customersRes = await fetch(
          `/api/${encodeURIComponent(storeName)}/customers`
        );
        if (!customersRes.ok) throw new Error("Failed to fetch customers");
        const data = await customersRes.json();
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || "Unknown error");
        setCustomers([]);
      }
      setLoading(false);
    };
    if (storeName) fetchCustomers();
  }, [storeName]);

  // CSV Export logic
  const handleExportCSV = () => {
    if (!customers.length) return;
    const headers = [
      'Name', 'Email', 'Phone', 'Address', 'Orders', 'Total Spent', 'Joined'
    ];
    const rows = customers.map((c) => [
      `${c.first_name} ${c.last_name}`,
      c.email,
      c.billing?.phone || '',
      [c.billing?.address_1, c.billing?.city, c.billing?.state, c.billing?.postcode, c.billing?.country].filter(Boolean).join(', '),
      c.orders_count ?? '',
      c.total_spent ? `$${parseFloat(c.total_spent).toFixed(2)}` : '',
      c.date_created ? new Date(c.date_created).toLocaleDateString() : ''
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${storeName}_customers.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-purple-500" /> Customers
        </h2>
        {customers.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded shadow text-sm"
          >
            Export CSV
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin h-5 w-5" /> Loading customers...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-gray-500">No customers found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-left">Orders</th>
                <th className="px-4 py-2 text-left">Total Spent</th>
                <th className="px-4 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 flex items-center gap-2">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="avatar" className="h-6 w-6 rounded-full" />
                    ) : (
                      <Users className="h-5 w-5 text-gray-400" />
                    )}
                    <span>{c.first_name} {c.last_name}</span>
                  </td>
                  <td className="px-4 py-2">
                    <a href={`mailto:${c.email}`} className="text-blue-600 underline flex items-center gap-1">
                      <Mail className="h-4 w-4" /> {c.email}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    {c.billing?.phone ? (
                      <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {c.billing.phone}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {[c.billing?.address_1, c.billing?.city, c.billing?.state, c.billing?.postcode, c.billing?.country].filter(Boolean).join(', ') || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-2 text-center">{c.orders_count ?? '-'}</td>
                  <td className="px-4 py-2 text-center">{c.total_spent ? `$${parseFloat(c.total_spent).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(c.date_created).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
