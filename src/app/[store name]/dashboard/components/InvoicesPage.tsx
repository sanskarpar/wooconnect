"use client";
import { useState, useEffect } from 'react';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Download,
  Filter,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { downloadInvoicePDF } from '@/lib/invoicePdfGenerator';

interface Invoice {
  id: string;
  number: string;
  universalNumber?: string; // Universal invoice number across all stores
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;
  orderStatus?: string;
  customerAddress?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    postcode?: string;
    country?: string;
    state?: string;
  };
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface InvoiceSettings {
  // Basic Info
  template: string;
  logoUrl: string;
  colorScheme: string;
  accentColor: string;
  
  // Company Details
  companyName: string;
  companyRegNumber: string;
  vatNumber: string;
  companyAddress: string;
  companyCity: string;
  companyPostcode: string;
  companyCountry: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  
  // Invoice Configuration
  invoicePrefix: string;
  invoiceNumberFormat: string;
  dueDays: number;
  lateFeePercentage: number;
  discountType: 'percentage' | 'fixed';
  
  // Layout & Styling
  fontSize: 'small' | 'medium' | 'large';
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  headerHeight: number;
  showWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  
  // Content
  footerText: string;
  terms: string;
  privacyPolicy: string;
  bankDetails: string;
  paymentInstructions: string;
  
  // Tax Settings
  defaultTaxRate: number;
  showTaxBreakdown: boolean;
  taxLabel: string;
  
  // Currency & Formatting
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  numberFormat: string;
  
  // Additional Fields
  purchaseOrderRef: boolean;
  projectRef: boolean;
  deliveryDate: boolean;
  notes: string;
  
  // Professional Features
  digitalSignature: string;
  approvedBy: string;
  invoiceStatus: boolean;
  showPaymentTerms: boolean;
  multiLanguage: boolean;
  language: string;
}

interface InvoicesPageProps {
  storeName: string;
}

export default function InvoicesPage({ storeName }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'number' | 'amount' | 'createdAt' | 'dueDate'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        console.log('Fetching invoices for store:', storeName);
        const res = await fetch(`/api/${encodeURIComponent(storeName)}/invoices`);
        console.log('Invoices API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('Invoices data received:', data);
          setInvoices(data.invoices || []);
        } else {
          const errorText = await res.text();
          console.error('Invoices API error:', res.status, errorText);
          setInvoices([]);
        }
      } catch (err) {
        console.error('Invoices fetch error:', err);
        setInvoices([]);
      }
      setLoading(false);
    };
    fetchInvoices();
  }, [storeName]);

  useEffect(() => {
    fetch('/api/invoice-settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      });
  }, [storeName]);

  const filteredInvoices = invoices
    .filter(invoice => filter === 'all' || invoice.status === filter)
    .filter(invoice => 
      searchTerm === '' ||
      invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.universalNumber && invoice.universalNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'number':
          // Sort by universal number if available, otherwise by regular number
          aValue = a.universalNumber || a.number;
          bValue = b.universalNumber || b.number;
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'dueDate':
          aValue = new Date(a.dueDate);
          bValue = new Date(b.dueDate);
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Professional Invoice PDF Generator using shared library
  const handleDownload = async (invoice: Invoice) => {
    try {
      await downloadInvoicePDF(invoice, settings || {}, storeName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleSort = (field: 'number' | 'amount' | 'createdAt' | 'dueDate') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const calculateTotalAmount = (status?: string) => {
    const targetInvoices = status ? invoices.filter(inv => inv.status === status) : invoices;
    return targetInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unpaid':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-50 text-green-700';
      case 'unpaid':
        return 'bg-yellow-50 text-yellow-700';
      case 'overdue':
        return 'bg-red-50 text-red-700';
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-lg">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Invoice Management</h1>
            <p className="text-gray-600 text-lg">
              Manage and track invoices for <span className="font-semibold text-blue-600">{storeName}</span>
            </p>
          </div>
        </div>

        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border-l-4 border-blue-500 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Total Invoices</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{invoices.length}</div>
                <div className="text-sm text-gray-500 mt-1">
                  ${calculateTotalAmount().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border-l-4 border-green-500 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Paid</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {invoices.filter(inv => inv.status === 'paid').length}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  ${calculateTotalAmount('paid').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border-l-4 border-yellow-500 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Pending</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {invoices.filter(inv => inv.status === 'unpaid').length}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  ${calculateTotalAmount('unpaid').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border-l-4 border-red-500 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Overdue</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {invoices.filter(inv => inv.status === 'overdue').length}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  ${calculateTotalAmount('overdue').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'paid', 'unpaid', 'overdue'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === status
                    ? 'bg-blue-100 text-blue-700 shadow-md border-2 border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className="ml-2 px-2 py-0.5 bg-current text-white rounded-full text-xs opacity-70">
                    {invoices.filter(inv => inv.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices, universal numbers, customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Professional Invoices Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Invoice List</h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/4"
                  onClick={() => handleSort('number')}
                >
                  <div className="flex items-center gap-2">
                    Invoice Number
                    <span className="text-xs text-gray-400 font-normal normal-case">(Universal #)</span>
                    <div className="flex flex-col">
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-b-2 ${
                        sortField === 'number' && sortDirection === 'asc' ? 'border-b-blue-500' : 'border-b-gray-300'
                      }`}></div>
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-t-2 ${
                        sortField === 'number' && sortDirection === 'desc' ? 'border-t-blue-500' : 'border-t-gray-300'
                      }`}></div>
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Customer
                </th>
                <th 
                  className="group px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/6"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2 justify-end">
                    Amount
                    <div className="flex flex-col">
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-b-2 ${
                        sortField === 'amount' && sortDirection === 'asc' ? 'border-b-blue-500' : 'border-b-gray-300'
                      }`}></div>
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-t-2 ${
                        sortField === 'amount' && sortDirection === 'desc' ? 'border-t-blue-500' : 'border-t-gray-300'
                      }`}></div>
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Status
                </th>
                <th 
                  className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/6"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-2">
                    Due Date
                    <div className="flex flex-col">
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-b-2 ${
                        sortField === 'dueDate' && sortDirection === 'asc' ? 'border-b-blue-500' : 'border-b-gray-300'
                      }`}></div>
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent border-t-2 ${
                        sortField === 'dueDate' && sortDirection === 'desc' ? 'border-t-blue-500' : 'border-t-gray-300'
                      }`}></div>
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice, index) => (
                <tr 
                  key={invoice.id} 
                  className={`hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap w-1/4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {invoice.universalNumber ? (
                            <div>
                              <div className="text-blue-600 font-semibold">#{invoice.universalNumber}</div>
                              <div className="text-xs text-gray-500">Store: {invoice.number}</div>
                            </div>
                          ) : (
                            invoice.number
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">Created {formatDate(invoice.createdAt)}</span>
                        </div>
                        {invoice.orderStatus && (
                          <div className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
                            Order: {invoice.orderStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{invoice.customerName}</div>
                      {invoice.customerEmail && (
                        <div className="text-sm text-gray-500 truncate">{invoice.customerEmail}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right w-1/6">
                    <div className="min-w-0">
                      <div className="text-lg font-bold text-gray-900">
                        ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      {invoice.items && invoice.items.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/8">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      <span className="hidden sm:inline">{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span>
                      <span className="sm:hidden">{invoice.status.charAt(0).toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-1/6">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900 font-medium truncate">
                        {formatDate(invoice.dueDate)}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-1/8">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        onClick={() => handleDownload(invoice)}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <FileText className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {filter === 'all' 
                ? 'No invoices have been created yet.'
                : `No ${filter} invoices found. Try adjusting your filters or search terms.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


