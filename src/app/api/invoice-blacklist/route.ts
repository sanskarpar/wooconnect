import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export interface BlacklistRule {
  id: string;
  type: 'customerName' | 'customerEmail' | 'storeName' | 'invoiceNumber' | 'amount' | 'status' | 'dateRange';
  condition: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between';
  value: string | number;
  value2?: string | number; // For "between" conditions
  caseSensitive?: boolean;
  enabled: boolean;
  name: string; // User-friendly name for the rule
  description?: string;
}

export interface BlacklistSettings {
  enabled: boolean;
  rules: BlacklistRule[];
  logExcludedInvoices: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    const blacklistCollection = db.collection('invoiceBlacklist');
    const blacklistDoc = await blacklistCollection.findOne({ userId: uid });
    
    const defaultSettings: BlacklistSettings = {
      enabled: false,
      rules: [],
      logExcludedInvoices: false
    };

    return NextResponse.json({ 
      settings: blacklistDoc?.settings || defaultSettings 
    }, { status: 200 });

  } catch (error) {
    console.error('Get blacklist settings error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const settings: BlacklistSettings = await req.json();
    
    // Validate the settings
    if (!settings.rules || !Array.isArray(settings.rules)) {
      return NextResponse.json({ message: 'Invalid blacklist settings format.' }, { status: 400 });
    }

    // Validate each rule
    for (const rule of settings.rules) {
      if (!rule.id || !rule.type || !rule.condition || !rule.name) {
        return NextResponse.json({ message: 'Invalid blacklist rule format.' }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db('wooconnect');
    
    const blacklistCollection = db.collection('invoiceBlacklist');
    
    await blacklistCollection.updateOne(
      { userId: uid },
      { 
        $set: { 
          settings,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    console.log(`Updated blacklist settings for user: ${uid}`);

    return NextResponse.json({ 
      message: 'Blacklist settings updated successfully.',
      settings 
    }, { status: 200 });

  } catch (error) {
    console.error('Update blacklist settings error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
