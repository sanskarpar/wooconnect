import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper to build WooCommerce REST API URL for testing connection
function buildWooApiUrl(baseUrl: string, endpoint: string, consumerKey: string, consumerSecret: string) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = new URL(`${cleanBaseUrl}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.append('consumer_key', consumerKey);
  url.searchParams.append('consumer_secret', consumerSecret);
  return url.toString();
}

// Helper to test WooCommerce connection
async function testWooConnection(baseUrl: string, consumerKey: string, consumerSecret: string) {
  try {
    const testUrl = buildWooApiUrl(baseUrl, 'system_status', consumerKey, consumerSecret);
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WooConnect/1.0'
      }
    });
    return response.ok;
  } catch (error) {
    console.error('WooCommerce connection test failed:', error);
    return false;
  }
}

// GET - Get store settings with credentials
export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { message: 'Store ID is required.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Fetch the store with credentials (only for the owner)
    const store = await stores.findOne({ 
      _id: new ObjectId(storeId),
      uid 
    });

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found or you do not have permission to access it.' },
        { status: 404 }
      );
    }

    // Return store with credentials (since this is for the settings page)
    const storeWithCredentials = {
      id: store._id.toString(),
      name: store.name,
      url: store.url,
      status: store.status,
      connectedAt: store.connectedAt,
      consumerKey: store.consumerKey || '',
      consumerSecret: store.consumerSecret || ''
    };

    return NextResponse.json(storeWithCredentials, { status: 200 });
  } catch (error) {
    console.error('Get store settings error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// PUT - Update store settings
export async function PUT(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const body = await req.json();
    const { storeId, name, url, consumerKey, consumerSecret } = body;

    // Validate required fields
    if (!storeId || !name || !url || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { message: 'All fields are required: storeId, name, url, consumerKey, consumerSecret' },
        { status: 400 }
      );
    }

    // Validate URL format
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Test WooCommerce connection
    const connectionValid = await testWooConnection(normalizedUrl, consumerKey, consumerSecret);
    if (!connectionValid) {
      return NextResponse.json(
        { message: 'Failed to connect to WooCommerce store. Please check your URL and API credentials.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Verify the store belongs to the current user
    const existingStore = await stores.findOne({ 
      _id: new ObjectId(storeId),
      uid 
    });

    if (!existingStore) {
      return NextResponse.json(
        { message: 'Store not found or you do not have permission to modify it.' },
        { status: 404 }
      );
    }

    // Update store settings
    const updateData = {
      name: name.trim(),
      url: normalizedUrl,
      consumerKey: consumerKey.trim(),
      consumerSecret: consumerSecret.trim(),
      status: 'connected',
      updatedAt: new Date().toISOString()
    };

    const result = await stores.updateOne(
      { _id: new ObjectId(storeId), uid },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: 'Store not found or update failed.' },
        { status: 404 }
      );
    }

    // Fetch the updated store (without secrets)
    const updatedStore = await stores.findOne({ _id: new ObjectId(storeId), uid });
    if (!updatedStore) {
      return NextResponse.json(
        { message: 'Failed to retrieve updated store.' },
        { status: 500 }
      );
    }

    // Return updated store without secrets
    const returnStore = {
      id: updatedStore._id.toString(),
      name: updatedStore.name,
      url: updatedStore.url,
      status: updatedStore.status,
      connectedAt: updatedStore.connectedAt,
      updatedAt: updatedStore.updatedAt,
      stats: updatedStore.stats || { products: 0, orders: 0, customers: 0 }
    };

    return NextResponse.json(returnStore, { status: 200 });
  } catch (error) {
    console.error('Update store settings error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete store
export async function DELETE(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const body = await req.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { message: 'Store ID is required.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const stores = db.collection('stores');

    // Verify the store belongs to the current user before deleting
    const existingStore = await stores.findOne({ 
      _id: new ObjectId(storeId),
      uid 
    });

    if (!existingStore) {
      return NextResponse.json(
        { message: 'Store not found or you do not have permission to delete it.' },
        { status: 404 }
      );
    }

    // Delete the store
    const result = await stores.deleteOne({ 
      _id: new ObjectId(storeId),
      uid 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: 'Store not found or deletion failed.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Store deleted successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete store error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
