// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// MongoDB URI and client handled in lib/mongodb
// ...existing code...

// ...existing code...

export async function DELETE(
  request: NextRequest,
  { params }: { params: { 'store name': string; productId: string } }
) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const storeName = decodeURIComponent(params['store name']);
    const productId = params.productId;
    
    console.log('Deleting product:', productId, 'for store:', storeName);

  const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Find the store for this user
    const store = await stores.findOne({ uid, name: storeName });
    if (!store) {
      return NextResponse.json({ message: 'Store not found.' }, { status: 404 });
    }

    // Delete product via WooCommerce API
    const productUrl = store.url.replace(/\/$/, '') + `/wp-json/wc/v3/products/${productId}`;
    const url = new URL(productUrl);
    url.searchParams.set('consumer_key', store.consumerKey);
    url.searchParams.set('consumer_secret', store.consumerSecret);
    url.searchParams.set('force', 'true'); // Permanently delete instead of moving to trash

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { 'User-Agent': 'WooConnect/1.0' }
    });

    if (!res.ok) {
      console.error('WooCommerce API error:', res.status, res.statusText);
      return NextResponse.json({ message: 'Failed to delete product from WooCommerce.' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { 'store name': string; productId: string } }
) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const storeName = decodeURIComponent(params['store name']);
    const productId = params.productId;
    const updateData = await request.json();
    
    console.log('Updating product:', productId, 'for store:', storeName, updateData);

  const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Find the store for this user
    const store = await stores.findOne({ uid, name: storeName });
    if (!store) {
      return NextResponse.json({ message: 'Store not found.' }, { status: 404 });
    }

    // Update product via WooCommerce API
    const productUrl = store.url.replace(/\/$/, '') + `/wp-json/wc/v3/products/${productId}`;
    const url = new URL(productUrl);
    url.searchParams.set('consumer_key', store.consumerKey);
    url.searchParams.set('consumer_secret', store.consumerSecret);

    // Transform our update data to WooCommerce format
    const wooUpdateData = {
      name: updateData.name,
      regular_price: updateData.price?.toString(),
      sale_price: updateData.salePrice?.toString() || '',
      sku: updateData.sku,
      stock_quantity: updateData.stockQuantity,
      stock_status: updateData.stockStatus,
      status: updateData.status,
      categories: Array.isArray(updateData.categories) 
        ? updateData.categories.map((cat: string) => ({ name: cat }))
        : [],
      tags: Array.isArray(updateData.tags) 
        ? updateData.tags.map((tag: string) => ({ name: tag }))
        : [],
      short_description: updateData.shortDescription || '',
      description: updateData.description || '',
      weight: updateData.weight || '',
      featured: updateData.featured || false
    };

    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WooConnect/1.0'
      },
      body: JSON.stringify(wooUpdateData)
    });

    if (!res.ok) {
      console.error('WooCommerce API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return NextResponse.json({ message: 'Failed to update product in WooCommerce.' }, { status: 400 });
    }

    const updatedWooProduct = await res.json();

    // Transform back to our format
    const updatedProduct = {
      id: updatedWooProduct.id.toString(),
      name: updatedWooProduct.name || '',
      price: parseFloat(updatedWooProduct.price || updatedWooProduct.regular_price || 0),
      salePrice: updatedWooProduct.sale_price ? parseFloat(updatedWooProduct.sale_price) : undefined,
      sku: updatedWooProduct.sku || '',
      stockQuantity: parseInt(updatedWooProduct.stock_quantity || 0),
      stockStatus: updatedWooProduct.stock_status,
      status: updatedWooProduct.status,
      categories: Array.isArray(updatedWooProduct.categories) 
        ? updatedWooProduct.categories.map((cat: any) => cat.name).filter(Boolean)
        : [],
      tags: Array.isArray(updatedWooProduct.tags) 
        ? updatedWooProduct.tags.map((tag: any) => tag.name).filter(Boolean)
        : [],
      images: Array.isArray(updatedWooProduct.images) 
        ? updatedWooProduct.images.map((img: any) => ({
            src: img.src || '',
            alt: img.alt || updatedWooProduct.name || ''
          }))
        : [],
      shortDescription: updatedWooProduct.short_description || '',
      description: updatedWooProduct.description || '',
      weight: updatedWooProduct.weight || '',
      totalSales: parseInt(updatedWooProduct.total_sales || 0),
      featured: updatedWooProduct.featured || false,
      createdAt: updatedWooProduct.date_created || new Date().toISOString(),
      updatedAt: updatedWooProduct.date_modified || new Date().toISOString()
    };

    return NextResponse.json(updatedProduct);

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}
