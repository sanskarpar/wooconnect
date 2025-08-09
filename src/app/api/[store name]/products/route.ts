// Removed 'use client' to ensure server-only execution
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// MongoDB URI and client handled in lib/mongodb
// ...existing code...
// ...existing code...

async function getStoreCredentials(storeName: string) {
  const client = await clientPromise;
  const db = client.db('wooconnect');
  const stores = db.collection('stores');
  const store = await stores.findOne({ name: storeName });
  if (!store) return null;
  return {
    url: store.url,
    consumerKey: store.consumerKey,
    consumerSecret: store.consumerSecret,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'store name': string }> }
) {
  try {
    const resolvedParams = await params;
    const storeName = decodeURIComponent(resolvedParams['store name']);
    console.log('Fetching products for store:', storeName);

    // Fetch WooCommerce credentials from DB
    const storeCreds = await getStoreCredentials(storeName);
    if (!storeCreds) {
      console.error('Store not found:', storeName);
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const { url: WC_STORE_URL, consumerKey: WC_CONSUMER_KEY, consumerSecret: WC_CONSUMER_SECRET } = storeCreds;

    if (!WC_STORE_URL || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
      console.error('WooCommerce credentials not set for store:', storeName);
      return NextResponse.json({ error: 'WooCommerce credentials not set for store' }, { status: 500 });
    }

    // Build WooCommerce API endpoint
    const endpoint = `${WC_STORE_URL}/wp-json/wc/v3/products?per_page=100`;

    // Basic Auth
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');

    // Fetch products from WooCommerce
    const wcRes = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!wcRes.ok) {
      const errorText = await wcRes.text();
      console.error('WooCommerce fetch failed:', wcRes.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch products from WooCommerce', details: errorText }, { status: wcRes.status });
    }

    const wcProducts = await wcRes.json();
    
    // Transform WooCommerce products to match our interface
    const products = wcProducts.map((product: any) => ({
      id: product.id.toString(),
      name: product.name,
      price: parseFloat(product.regular_price) || 0,
      salePrice: product.sale_price ? parseFloat(product.sale_price) : undefined,
      sku: product.sku || '',
      stockQuantity: product.stock_quantity || 0,
      stockStatus: product.stock_status || 'instock',
      status: product.status || 'publish',
      categories: product.categories?.map((cat: any) => cat.name) || [],
      tags: product.tags?.map((tag: any) => tag.name) || [],
      images: product.images?.map((img: any) => ({
        src: img.src,
        alt: img.alt || product.name
      })) || [],
      shortDescription: product.short_description || '',
      description: product.description || '',
      weight: product.weight || '',
      dimensions: product.dimensions ? {
        length: product.dimensions.length || '',
        width: product.dimensions.width || '',
        height: product.dimensions.height || ''
      } : undefined,
      totalSales: product.total_sales || 0,
      featured: product.featured || false,
      createdAt: product.date_created || new Date().toISOString(),
      updatedAt: product.date_modified || new Date().toISOString()
    }));

    return NextResponse.json({ 
      products: products,
      total: products.length 
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { 'store name': string } }
) {
  try {
    const storeName = decodeURIComponent(params['store name']);
    const productData = await request.json();
    console.log('Creating product for store:', storeName, productData);

    // Fetch WooCommerce credentials from DB
    const storeCreds = await getStoreCredentials(storeName);
    if (!storeCreds) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const { url: WC_STORE_URL, consumerKey: WC_CONSUMER_KEY, consumerSecret: WC_CONSUMER_SECRET } = storeCreds;

    if (!WC_STORE_URL || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
      return NextResponse.json({ error: 'WooCommerce credentials not set for store' }, { status: 500 });
    }

    // Build WooCommerce API endpoint
    const endpoint = `${WC_STORE_URL}/wp-json/wc/v3/products`;

    // Basic Auth
    const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');

    // Transform data to WooCommerce format
    const wcProductData = {
      name: productData.name,
      type: 'simple',
      regular_price: productData.price.toString(),
      sale_price: productData.salePrice ? productData.salePrice.toString() : '',
      sku: productData.sku,
      stock_quantity: productData.stockQuantity,
      stock_status: productData.stockStatus,
      status: productData.status,
      short_description: productData.shortDescription,
      description: productData.description,
      weight: productData.weight,
      featured: productData.featured,
      categories: productData.categories.map((cat: string) => ({ name: cat })),
      tags: productData.tags.map((tag: string) => ({ name: tag }))
    };

    // Create product in WooCommerce
    const wcRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(wcProductData)
    });

    if (!wcRes.ok) {
      const errorText = await wcRes.text();
      console.error('WooCommerce product creation failed:', wcRes.status, errorText);
      return NextResponse.json({ error: 'WooCommerce product creation failed', details: errorText }, { status: wcRes.status });
    }

    const createdProduct = await wcRes.json();
    
    // Transform back to our format
    const transformedProduct = {
      id: createdProduct.id.toString(),
      name: createdProduct.name,
      price: parseFloat(createdProduct.regular_price) || 0,
      salePrice: createdProduct.sale_price ? parseFloat(createdProduct.sale_price) : undefined,
      sku: createdProduct.sku || '',
      stockQuantity: createdProduct.stock_quantity || 0,
      stockStatus: createdProduct.stock_status || 'instock',
      status: createdProduct.status || 'publish',
      categories: createdProduct.categories?.map((cat: any) => cat.name) || [],
      tags: createdProduct.tags?.map((tag: any) => tag.name) || [],
      images: createdProduct.images?.map((img: any) => ({
        src: img.src,
        alt: img.alt || createdProduct.name
      })) || [],
      shortDescription: createdProduct.short_description || '',
      description: createdProduct.description || '',
      weight: createdProduct.weight || '',
      totalSales: 0,
      featured: createdProduct.featured || false,
      createdAt: createdProduct.date_created || new Date().toISOString(),
      updatedAt: createdProduct.date_modified || new Date().toISOString()
    };

    return NextResponse.json(transformedProduct, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}


