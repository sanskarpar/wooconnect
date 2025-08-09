import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wooconnect';
let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// Default professional UK invoice settings
const defaultSettings = {
  // Basic Info
  logoUrl: '',
  colorScheme: '#1e293b',
  accentColor: '#0f172a',
  
  // Company Details
  companyName: '',
  companyRegNumber: '',
  vatNumber: '',
  companyAddress: '',
  companyCity: '',
  companyPostcode: '',
  companyCountry: 'United Kingdom',
  companyEmail: '',
  companyPhone: '',
  companyWebsite: '',
  
  // Invoice Configuration
  invoicePrefix: 'INV',
  invoiceNumberFormat: 'INV-{YYYY}{MM}{DD}-{###}',
  dueDays: 30,
  lateFeePercentage: 2.5,
  discountType: 'percentage',
  
  // Layout & Styling
  fontSize: 'medium',
  showLogo: true,
  logoPosition: 'left',
  headerHeight: 140,
  showWatermark: false,
  watermarkText: 'INVOICE',
  watermarkOpacity: 0.1,
  
  // Content
  footerText: 'Thank you for your business!',
  terms: 'Payment is due within 30 days of invoice date. Late payments may incur additional charges.',
  privacyPolicy: '',
  bankDetails: '',
  paymentInstructions: 'Please reference the invoice number when making payment.',
  
  // Tax Settings
  defaultTaxRate: 20,
  showTaxBreakdown: true,
  taxLabel: 'VAT',
  
  // Currency & Formatting
  currency: 'GBP',
  currencySymbol: '£',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'UK',
  
  // Additional Fields
  purchaseOrderRef: true,
  projectRef: false,
  deliveryDate: false,
  notes: '',
  
  // Professional Features
  digitalSignature: '',
  approvedBy: '',
  invoiceStatus: true,
  showPaymentTerms: true,
  multiLanguage: false,
  language: 'en-GB',
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const uid = session.user.id;
    const client = await getClient();
    const db = client.db('wooconnect');
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(uid) });
    // Always merge with defaults to ensure all fields are present
    const settings = { ...defaultSettings, ...(user?.invoiceSettings || {}) };
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error('Get invoice settings error:', err);
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
    const body = await req.json();
    
    // Validate base64 image if provided
    if (body.logoUrl && body.logoUrl.startsWith('data:')) {
      try {
        const base64Data = body.logoUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid base64 data');
        }
        // Validate it's a proper image format
        if (!body.logoUrl.match(/^data:image\/(png|jpeg|jpg);base64,/)) {
          throw new Error('Only PNG and JPEG images are supported');
        }
        // Check file size (limit to 2MB encoded)
        if (base64Data.length > 2.7 * 1024 * 1024) { // ~2MB when decoded
          throw new Error('Logo file too large. Please use an image under 2MB.');
        }
      } catch (logoError) {
        return NextResponse.json({ 
          message: `Invalid logo: ${logoError instanceof Error ? logoError.message : 'Unknown error'}` 
        }, { status: 400 });
      }
    }
    
    // Comprehensive type validation and sanitization
    const settings = {
      ...defaultSettings,
      ...body,
      // Ensure logoUrl is properly stored
      logoUrl: body.logoUrl || defaultSettings.logoUrl,
      // Numeric fields with validation
      dueDays: body.dueDays !== undefined ? Math.max(0, Math.min(365, Number(body.dueDays))) : defaultSettings.dueDays,
      lateFeePercentage: body.lateFeePercentage !== undefined ? Math.max(0, Math.min(50, Number(body.lateFeePercentage))) : defaultSettings.lateFeePercentage,
      
      // Tax settings with proper validation
      defaultTaxRate: body.defaultTaxRate !== undefined ? Math.max(0, Math.min(100, Number(body.defaultTaxRate))) : defaultSettings.defaultTaxRate,
      taxLabel: body.taxLabel ? String(body.taxLabel).trim() : defaultSettings.taxLabel,
      showTaxBreakdown: typeof body.showTaxBreakdown === 'boolean' ? body.showTaxBreakdown : defaultSettings.showTaxBreakdown,
      
      // String fields with defaults
      currency: body.currency || defaultSettings.currency,
      currencySymbol: body.currencySymbol || defaultSettings.currencySymbol,
      colorScheme: body.colorScheme || defaultSettings.colorScheme,
      accentColor: body.accentColor || defaultSettings.accentColor,
      companyName: body.companyName || defaultSettings.companyName,
      companyRegNumber: body.companyRegNumber || defaultSettings.companyRegNumber,
      vatNumber: body.vatNumber || defaultSettings.vatNumber,
      companyAddress: body.companyAddress || defaultSettings.companyAddress,
      companyCity: body.companyCity || defaultSettings.companyCity,
      companyPostcode: body.companyPostcode || defaultSettings.companyPostcode,
      companyCountry: body.companyCountry || defaultSettings.companyCountry,
      companyEmail: body.companyEmail || defaultSettings.companyEmail,
      companyPhone: body.companyPhone || defaultSettings.companyPhone,
      companyWebsite: body.companyWebsite || defaultSettings.companyWebsite,
      invoicePrefix: body.invoicePrefix || defaultSettings.invoicePrefix,
      invoiceNumberFormat: body.invoiceNumberFormat || defaultSettings.invoiceNumberFormat,
      discountType: body.discountType === 'fixed' ? 'fixed' : 'percentage',
      fontSize: ['small', 'medium', 'large'].includes(body.fontSize) ? body.fontSize : defaultSettings.fontSize,
      logoPosition: ['left', 'center', 'right'].includes(body.logoPosition) ? body.logoPosition : defaultSettings.logoPosition,
      footerText: body.footerText || defaultSettings.footerText,
      terms: body.terms || defaultSettings.terms,
      privacyPolicy: body.privacyPolicy || defaultSettings.privacyPolicy,
      bankDetails: body.bankDetails || defaultSettings.bankDetails,
      paymentInstructions: body.paymentInstructions || defaultSettings.paymentInstructions,
      dateFormat: body.dateFormat || defaultSettings.dateFormat,
      numberFormat: body.numberFormat || defaultSettings.numberFormat,
      notes: body.notes || defaultSettings.notes,
      digitalSignature: body.digitalSignature || defaultSettings.digitalSignature,
      approvedBy: body.approvedBy || defaultSettings.approvedBy,
      language: body.language || defaultSettings.language,
      watermarkText: body.watermarkText || defaultSettings.watermarkText,
      
      // Boolean fields with proper validation
      showLogo: typeof body.showLogo === 'boolean' ? body.showLogo : defaultSettings.showLogo,
      purchaseOrderRef: typeof body.purchaseOrderRef === 'boolean' ? body.purchaseOrderRef : defaultSettings.purchaseOrderRef,
      projectRef: typeof body.projectRef === 'boolean' ? body.projectRef : defaultSettings.projectRef,
      deliveryDate: typeof body.deliveryDate === 'boolean' ? body.deliveryDate : defaultSettings.deliveryDate,
      invoiceStatus: typeof body.invoiceStatus === 'boolean' ? body.invoiceStatus : defaultSettings.invoiceStatus,
      showPaymentTerms: typeof body.showPaymentTerms === 'boolean' ? body.showPaymentTerms : defaultSettings.showPaymentTerms,
      multiLanguage: typeof body.multiLanguage === 'boolean' ? body.multiLanguage : defaultSettings.multiLanguage,
      showWatermark: typeof body.showWatermark === 'boolean' ? body.showWatermark : defaultSettings.showWatermark,
    };
    
    // Log the tax settings for debugging
    console.log('Saving tax settings:', {
      defaultTaxRate: settings.defaultTaxRate,
      taxLabel: settings.taxLabel,
      showTaxBreakdown: settings.showTaxBreakdown
    });
    
    const client = await getClient();
    const db = client.db('wooconnect');
    const users = db.collection('users');
    
    await users.updateOne(
      { _id: new ObjectId(uid) },
      { 
        $set: { 
          invoiceSettings: settings,
          updatedAt: new Date().toISOString()
        } 
      },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (err) {
    console.error('Save invoice settings error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
