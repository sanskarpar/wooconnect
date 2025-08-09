"use client";
import { useState, useEffect } from 'react';
import { Package, Plus, Edit3, Trash2, Search, Filter, Eye, Star, DollarSign, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  sku: string;
  stockQuantity: number;
  stockStatus: 'instock' | 'outofstock' | 'onbackorder';
  status: 'publish' | 'draft' | 'private';
  categories: string[];
  tags: string[];
  images: Array<{
    src: string;
    alt?: string;
  }>;
  shortDescription?: string;
  description?: string;
  weight?: string;
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };
  totalSales?: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductsPageProps {
  storeName: string;
}

export default function ProductsPage({ storeName }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'publish' | 'draft' | 'instock' | 'outofstock'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // New product form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    salePrice: '',
    sku: '',
    stockQuantity: '',
    stockStatus: 'instock' as const,
    status: 'publish' as const,
    categories: '',
    tags: '',
    shortDescription: '',
    description: '',
    weight: '',
    featured: false
  });

  // Edit product form state
  const [editProduct, setEditProduct] = useState({
    name: '',
    price: '',
    salePrice: '',
    sku: '',
    stockQuantity: '',
    stockStatus: 'instock' as 'instock' | 'outofstock' | 'onbackorder',
    status: 'publish' as 'publish' | 'draft' | 'private',
    categories: '',
    tags: '',
    shortDescription: '',
    description: '',
    weight: '',
    featured: false
  });

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching products for store:', storeName);
        const res = await fetch(`/api/${encodeURIComponent(storeName)}/products`);
        console.log('Products API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('Products data received:', data);
          setProducts(data.products || []);
        } else {
          const errorText = await res.text();
          console.error('Products API error:', res.status, errorText);
          setError('Failed to fetch products.');
        }
      } catch (err) {
        console.error('Products fetch error:', err);
        setError('Failed to fetch products.');
      }
      setLoading(false);
    };
    fetchProducts();
  }, [storeName]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'publish':
      case 'draft':
        return product.status === filter;
      case 'instock':
      case 'outofstock':
        return product.stockStatus === filter;
      default:
        return true;
    }
  });

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'instock':
        return 'bg-green-50 text-green-700';
      case 'outofstock':
        return 'bg-red-50 text-red-700';
      case 'onbackorder':
        return 'bg-yellow-50 text-yellow-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'publish':
        return 'bg-green-50 text-green-700';
      case 'draft':
        return 'bg-gray-50 text-gray-700';
      case 'private':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const handleAddProduct = async () => {
    try {
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        salePrice: newProduct.salePrice ? parseFloat(newProduct.salePrice) : undefined,
        stockQuantity: parseInt(newProduct.stockQuantity),
        categories: newProduct.categories.split(',').map(c => c.trim()).filter(Boolean),
        tags: newProduct.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(`/api/${encodeURIComponent(storeName)}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      if (res.ok) {
        const createdProduct = await res.json();
        setProducts(prev => [...prev, createdProduct]);
        setShowAddModal(false);
        setSuccess('Product added successfully!');
        setError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
        setNewProduct({
          name: '',
          price: '',
          salePrice: '',
          sku: '',
          stockQuantity: '',
          stockStatus: 'instock',
          status: 'publish',
          categories: '',
          tags: '',
          shortDescription: '',
          description: '',
          weight: '',
          featured: false
        });
      } else {
        setError('Failed to add product');
      }
    } catch (err) {
      setError('Failed to add product');
    }
  };

  const handleEditProduct = (product: Product) => {
    setError(null);
    setSuccess(null);
    setEditProduct({
      name: product.name,
      price: product.price.toString(),
      salePrice: product.salePrice?.toString() || '',
      sku: product.sku,
      stockQuantity: product.stockQuantity.toString(),
      stockStatus: product.stockStatus,
      status: product.status,
      categories: product.categories.join(', '),
      tags: product.tags.join(', '),
      shortDescription: product.shortDescription || '',
      description: product.description || '',
      weight: product.weight || '',
      featured: product.featured
    });
    setEditingProduct(product);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    try {
      const productData = {
        ...editProduct,
        price: parseFloat(editProduct.price),
        salePrice: editProduct.salePrice ? parseFloat(editProduct.salePrice) : undefined,
        stockQuantity: parseInt(editProduct.stockQuantity),
        categories: editProduct.categories.split(',').map(c => c.trim()).filter(Boolean),
        tags: editProduct.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(`/api/${encodeURIComponent(storeName)}/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      if (res.ok) {
        const updatedProduct = await res.json();
        // Update the products list with the edited data, preserving original structure
        setProducts(prev => prev.map(p => {
          if (p.id === editingProduct.id) {
            return {
              ...p,
              name: productData.name || editProduct.name,
              price: productData.price,
              salePrice: productData.salePrice,
              sku: productData.sku || editProduct.sku,
              stockQuantity: productData.stockQuantity,
              stockStatus: productData.stockStatus || editProduct.stockStatus,
              status: productData.status || editProduct.status,
              categories: productData.categories,
              tags: productData.tags,
              shortDescription: editProduct.shortDescription,
              description: editProduct.description,
              weight: editProduct.weight,
              featured: editProduct.featured,
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        }));
        setEditingProduct(null);
        setSuccess('Product updated successfully!');
        setError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
        setEditProduct({
          name: '',
          price: '',
          salePrice: '',
          sku: '',
          stockQuantity: '',
          stockStatus: 'instock',
          status: 'publish',
          categories: '',
          tags: '',
          shortDescription: '',
          description: '',
          weight: '',
          featured: false
        });
      } else {
        setError('Failed to update product');
      }
    } catch (err) {
      setError('Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const res = await fetch(`/api/${encodeURIComponent(storeName)}/products/${productId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        setSuccess('Product deleted successfully!');
        setError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to delete product');
      }
    } catch (err) {
      setError('Failed to delete product');
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
        <div className="text-gray-500">Loading products...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage products for {storeName}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setSuccess(null);
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'publish', 'draft', 'instock', 'outofstock'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-1">
                  ({products.filter(product =>
                    status === 'publish' || status === 'draft'
                      ? product.status === status
                      : product.stockStatus === status
                  ).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : ''}`}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
          >
            <Package className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="text-blue-500 h-5 w-5" />
            <span className="text-sm font-medium text-blue-700">Total Products</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{products.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-500 h-5 w-5" />
            <span className="text-sm font-medium text-green-700">In Stock</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {products.filter(product => product.stockStatus === 'instock').length}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-500 h-5 w-5" />
            <span className="text-sm font-medium text-red-700">Out of Stock</span>
          </div>
          <div className="text-2xl font-bold text-red-900">
            {products.filter(product => product.stockStatus === 'outofstock').length}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="text-yellow-500 h-5 w-5" />
            <span className="text-sm font-medium text-yellow-700">Featured</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {products.filter(product => product.featured).length}
          </div>
        </div>
      </div>

      {/* Products Table/Grid */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.images?.[0] && (
                          <img
                            className="h-10 w-10 rounded-lg object-cover mr-3"
                            src={product.images[0].src}
                            alt={product.images[0].alt || product.name}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                            {product.name}
                            {product.featured && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
                          </div>
                          <div className="text-sm text-gray-500">{product.categories.join(', ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-bold text-green-700">
                        ${product.salePrice || product.price}
                        {product.salePrice && (
                          <span className="ml-2 text-gray-400 line-through">${product.price}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">{product.stockQuantity}</div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(product.stockStatus)}`}>
                        {product.stockStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(product.status)}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              {product.images?.[0] && (
                <img
                  className="w-full h-40 object-cover rounded-lg mb-3"
                  src={product.images[0].src}
                  alt={product.images[0].alt || product.name}
                />
              )}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 flex-1 mr-2">{product.name}</h3>
                {product.featured && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
              </div>
              <p className="text-xs text-gray-500 mb-2">SKU: {product.sku}</p>
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-bold text-green-700">
                  ${product.salePrice || product.price}
                  {product.salePrice && (
                    <span className="ml-2 text-sm text-gray-400 line-through">${product.price}</span>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(product.stockStatus)}`}>
                  {product.stockStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(product.status)}`}>
                  {product.status}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500">
            {filter === 'all' && !searchTerm
              ? 'No products have been created yet.'
              : `No products match your current filters.`
            }
          </p>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regular Price *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.salePrice}
                  onChange={(e) => setNewProduct({...newProduct, salePrice: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity *</label>
                <input
                  type="number"
                  value={newProduct.stockQuantity}
                  onChange={(e) => setNewProduct({...newProduct, stockQuantity: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                <select
                  value={newProduct.stockStatus}
                  onChange={(e) => setNewProduct({...newProduct, stockStatus: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newProduct.status}
                  onChange={(e) => setNewProduct({...newProduct, status: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="publish">Published</option>
                  <option value="draft">Draft</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input
                  type="text"
                  value={newProduct.weight}
                  onChange={(e) => setNewProduct({...newProduct, weight: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1.5 kg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>
                <input
                  type="text"
                  value={newProduct.categories}
                  onChange={(e) => setNewProduct({...newProduct, categories: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Electronics, Gadgets"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newProduct.tags}
                  onChange={(e) => setNewProduct({...newProduct, tags: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., new, featured, sale"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <textarea
                  value={newProduct.shortDescription}
                  onChange={(e) => setNewProduct({...newProduct, shortDescription: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProduct.featured}
                    onChange={(e) => setNewProduct({...newProduct, featured: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured Product</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProduct}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({...editProduct, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input
                  type="text"
                  value={editProduct.sku}
                  onChange={(e) => setEditProduct({...editProduct, sku: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regular Price *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editProduct.price}
                  onChange={(e) => setEditProduct({...editProduct, price: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editProduct.salePrice}
                  onChange={(e) => setEditProduct({...editProduct, salePrice: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity *</label>
                <input
                  type="number"
                  value={editProduct.stockQuantity}
                  onChange={(e) => setEditProduct({...editProduct, stockQuantity: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                <select
                  value={editProduct.stockStatus}
                  onChange={(e) => setEditProduct({...editProduct, stockStatus: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editProduct.status}
                  onChange={(e) => setEditProduct({...editProduct, status: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="publish">Published</option>
                  <option value="draft">Draft</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input
                  type="text"
                  value={editProduct.weight}
                  onChange={(e) => setEditProduct({...editProduct, weight: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1.5 kg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>
                <input
                  type="text"
                  value={editProduct.categories}
                  onChange={(e) => setEditProduct({...editProduct, categories: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Electronics, Gadgets"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editProduct.tags}
                  onChange={(e) => setEditProduct({...editProduct, tags: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., new, featured, sale"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <textarea
                  value={editProduct.shortDescription}
                  onChange={(e) => setEditProduct({...editProduct, shortDescription: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editProduct.featured}
                    onChange={(e) => setEditProduct({...editProduct, featured: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured Product</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setEditProduct({
                    name: '',
                    price: '',
                    salePrice: '',
                    sku: '',
                    stockQuantity: '',
                    stockStatus: 'instock',
                    status: 'publish',
                    categories: '',
                    tags: '',
                    shortDescription: '',
                    description: '',
                    weight: '',
                    featured: false
                  });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Update Product
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="text-green-500 text-lg font-semibold mt-6 text-center">{success}</div>
      )}

      {error && (
        <div className="text-red-500 text-lg font-semibold mt-6 text-center">{error}</div>
      )}
    </div>
  );
}
