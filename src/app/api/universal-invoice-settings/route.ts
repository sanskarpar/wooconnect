import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const uid = session.user.id;
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const collection = db.collection('universalInvoiceSettings');

    // Get universal invoice settings for this user
    const settings = await collection.findOne({ userId: uid });

    if (!settings) {
      // Return default settings if none exist
      const defaultSettings = {
        // Basic Info
        colorScheme: '#000000',
        accentColor: '#000000',
        
        // Company Details
        companyName: 'Your Company',
        companyRegNumber: '',
        vatNumber: '',
        companyAddress: '',
        companyCity: '',
        companyPostcode: '',
        companyCountry: '',
        companyEmail: '',
        companyPhone: '',
        companyWebsite: '',
        
        // Invoice Configuration
        invoicePrefix: '',
        invoiceNumberFormat: '{YYYY} - {###}',
        lateFeePercentage: 0,
        discountType: 'percentage',
        
        // Tax Settings
        defaultTaxRate: 0,
        showTaxBreakdown: false,
        taxLabel: 'Tax',
        kleinunternehmerNote: 'Hinweis: Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird Umsatzsteuer nicht berechnet',
        
        // Currency & Formatting
        currencySymbol: '€',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: 'DE',
        
        // Additional Fields
        purchaseOrderRef: false,
        projectRef: false,
        deliveryDate: true,
        
        // Professional Features
        approvedBy: '',
        invoiceStatus: false,
        showPaymentTerms: false,
        multiLanguage: false,
        language: 'en-US',
      };
      
      return NextResponse.json({ settings: defaultSettings }, { status: 200 });
    }

    // Remove MongoDB specific fields
    const { _id, userId, ...cleanSettings } = settings;
    return NextResponse.json({ settings: cleanSettings }, { status: 200 });

  } catch (error) {
    console.error('Get universal invoice settings error:', error);
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
    const settings = await req.json();

    const client = await clientPromise;
    const db = client.db('wooconnect');
    const collection = db.collection('universalInvoiceSettings');

    // Update or insert settings for this user
    const result = await collection.replaceOne(
      { userId: uid },
      { 
        userId: uid,
        ...settings,
        updatedAt: new Date().toISOString()
      },
      { upsert: true }
    );

    if (!result.acknowledged) {
      return NextResponse.json({ message: 'Failed to save settings.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Settings saved successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Save universal invoice settings error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
