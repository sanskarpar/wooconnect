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
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;
  orderStatus?: string;
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
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'number':
          aValue = a.number;
          bValue = b.number;
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

  // Professional UK-Style Invoice PDF Generator
  const handleDownload = async (invoice: Invoice) => {
    const s = settings || {
      template: 'uk-standard',
      logoUrl: '',
      colorScheme: '#1f2937',
      accentColor: '#3b82f6',
      companyName: storeName,
      companyRegNumber: '',
      vatNumber: '',
      companyAddress: '',
      companyCity: '',
      companyPostcode: '',
      companyCountry: 'United Kingdom',
      companyEmail: '',
      companyPhone: '',
      companyWebsite: '',
      invoicePrefix: 'INV',
      dueDays: 30,
      showLogo: true,
      logoPosition: 'left',
      headerHeight: 140,
      showWatermark: false,
      watermarkText: 'INVOICE',
      watermarkOpacity: 0.1,
      footerText: 'Thank you for your business',
      terms: 'Payment is due within 30 days of invoice date.',
      bankDetails: '',
      paymentInstructions: 'Please reference the invoice number when making payment.',
      defaultTaxRate: 20,
      showTaxBreakdown: true,
      taxLabel: 'VAT',
      currency: 'GBP',
      currencySymbol: '£',
      dateFormat: 'DD/MM/YYYY',
      digitalSignature: '',
      approvedBy: '',
      showPaymentTerms: true,
      language: 'en-GB',
      fontSize: 'medium',
      notes: ''
    };

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to convert hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
      } : { r: 0.15, g: 0.19, b: 0.25 };
    };

    // Color definitions using settings
    const primaryColorHex = hexToRgb(s.colorScheme);
    const accentColorHex = hexToRgb(s.accentColor);
    const primaryColor = rgb(primaryColorHex.r, primaryColorHex.g, primaryColorHex.b);
    const accentColor = rgb(accentColorHex.r, accentColorHex.g, accentColorHex.b);
    const lightAccent = rgb(0.95, 0.97, 1);
    const darkGray = rgb(0.17, 0.17, 0.19);
    const mediumGray = rgb(0.48, 0.48, 0.52);
    const lightGray = rgb(0.93, 0.94, 0.96);
    const white = rgb(1, 1, 1);

    // Font sizes
    const titleSize = 20;
    const headerSize = 12;
    const subHeaderSize = 10;
    const normalSize = 9;
    const smallSize = 8;

    let yPos = pageHeight - margin;

    // Header background
    page.drawRectangle({
      x: 0,
      y: pageHeight - 120,
      width: pageWidth,
      height: 120,
      color: primaryColor
    });

    // Blue accent stripe
    page.drawRectangle({
      x: 0,
      y: pageHeight - 125,
      width: pageWidth,
      height: 5,
      color: accentColor
    });

    // Logo and Company name section - left side
    yPos = pageHeight - 20;
    let logoWidth = 0;
    let logoHeight = 0;
    
    // Embed and display logo if available and enabled
    if (s.showLogo && s.logoUrl) {
      try {
        let logoImage;
        
        // Handle base64 encoded images
        if (s.logoUrl.startsWith('data:')) {
          const base64Data = s.logoUrl.split(',')[1];
          const logoBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          // Determine image type from data URL
          if (s.logoUrl.includes('data:image/png')) {
            logoImage = await pdfDoc.embedPng(logoBytes);
          } else if (s.logoUrl.includes('data:image/jpeg') || s.logoUrl.includes('data:image/jpg')) {
            logoImage = await pdfDoc.embedJpg(logoBytes);
          } else {
            throw new Error('Unsupported image format. Please use PNG or JPG.');
          }
        } else {
          // Handle URL-based images (with CORS handling)
          try {
            const logoResponse = await fetch(s.logoUrl, {
              mode: 'cors',
              headers: {
                'Accept': 'image/*',
              }
            });
            
            if (!logoResponse.ok) {
              throw new Error(`Failed to fetch logo: ${logoResponse.status}`);
            }
            
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            const logoBytes = new Uint8Array(logoArrayBuffer);
            
            // Determine image type from URL or content type
            const contentType = logoResponse.headers.get('content-type');
            if (contentType?.includes('png') || s.logoUrl.toLowerCase().includes('.png')) {
              logoImage = await pdfDoc.embedPng(logoBytes);
            } else if (contentType?.includes('jpeg') || contentType?.includes('jpg') || 
                      s.logoUrl.toLowerCase().includes('.jpg') || s.logoUrl.toLowerCase().includes('.jpeg')) {
              logoImage = await pdfDoc.embedJpg(logoBytes);
            } else {
              throw new Error('Unsupported image format from URL');
            }
          } catch (fetchError) {
            console.warn('Failed to fetch logo from URL:', fetchError);
            throw new Error('Could not load logo from URL. Please upload a local image file.');
          }
        }
        
        // Calculate logo dimensions (max 35px height, maintain aspect ratio)
        const logoAspectRatio = logoImage.width / logoImage.height;
        logoHeight = Math.min(35, s.headerHeight * 0.35);
        logoWidth = logoHeight * logoAspectRatio;
        
        // Ensure logo doesn't exceed reasonable width
        const maxLogoWidth = contentWidth * 0.25;
        if (logoWidth > maxLogoWidth) {
          logoWidth = maxLogoWidth;
          logoHeight = logoWidth / logoAspectRatio;
        }
        
        // Position logo based on logoPosition setting
        let logoX = margin;
        if (s.logoPosition === 'center') {
          logoX = (pageWidth - logoWidth) / 2;
        } else if (s.logoPosition === 'right') {
          logoX = pageWidth - margin - logoWidth;
        }
        
        // Draw the logo
        page.drawImage(logoImage, {
          x: logoX,
          y: yPos - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        
        // Adjust yPos for company name to be below logo with proper spacing
        yPos -= (logoHeight + 15);
      } catch (error) {
        console.error('Error embedding logo:', error);
      }
    }

    // Company name - positioned below logo or at top if no logo
    let companyNameX = margin;
    if (s.logoPosition === 'center') {
      const companyNameWidth = fontBold.widthOfTextAtSize((s.companyName || storeName).toUpperCase(), titleSize);
      companyNameX = (pageWidth - companyNameWidth) / 2;
    } else if (s.logoPosition === 'right') {
      const companyNameWidth = fontBold.widthOfTextAtSize((s.companyName || storeName).toUpperCase(), titleSize);
      companyNameX = pageWidth - margin - companyNameWidth;
    }

    page.drawText((s.companyName || storeName).toUpperCase(), {
      x: companyNameX,
      y: yPos,
      size: titleSize,
      font: fontBold,
      color: white
    });

    // Company registration info - positioned below company name
    yPos -= 18;
    let regInfoX = companyNameX;
    
    if (s.companyRegNumber) {
      page.drawText(`Reg: ${s.companyRegNumber}`, {
        x: regInfoX,
        y: yPos,
        size: smallSize,
        font,
        color: rgb(0.9, 0.9, 0.9)
      });
    }
    if (s.vatNumber) {
      const regText = s.companyRegNumber ? ` | VAT: ${s.vatNumber}` : `VAT: ${s.vatNumber}`;
      const startX = s.companyRegNumber ? regInfoX + font.widthOfTextAtSize(`Reg: ${s.companyRegNumber}`, smallSize) : regInfoX;
      page.drawText(regText, {
        x: startX,
        y: yPos,
        size: smallSize,
        font,
        color: rgb(0.9, 0.9, 0.9)
      });
    }

    // Invoice title and details - right side
    const invoiceTitleX = pageWidth - margin - 140;
    page.drawText('INVOICE', {
      x: invoiceTitleX,
      y: pageHeight - 35,
      size: titleSize,
      font: fontBold,
      color: white
    });

    page.drawText(invoice.number, {
      x: invoiceTitleX,
      y: pageHeight - 55,
      size: headerSize,
      font: fontBold,
      color: accentColor
    });

    // Status badge
    let statusBg = mediumGray;
    if (invoice.status === 'paid') statusBg = rgb(0.13, 0.69, 0.31);
    else if (invoice.status === 'overdue') statusBg = rgb(0.86, 0.24, 0.32);
    else if (invoice.status === 'unpaid') statusBg = rgb(0.97, 0.62, 0.13);

    const statusText = invoice.status.toUpperCase();
    const statusWidth = fontBold.widthOfTextAtSize(statusText, smallSize) + 12;

    page.drawRectangle({
      x: pageWidth - margin - statusWidth,
      y: pageHeight - 80,
      width: statusWidth,
      height: 16,
      color: statusBg
    });

    page.drawText(statusText, {
      x: pageWidth - margin - statusWidth + 6,
      y: pageHeight - 76,
      size: smallSize,
      font: fontBold,
      color: white
    });

    // Main content starts here - adjust yPos to account for dynamic header height
    yPos = pageHeight - Math.max(140, 80 + (s.showLogo && s.logoUrl ? 60 : 0));

    // Company information - left side
    let companyY = yPos;
    page.drawText('From:', {
      x: margin,
      y: companyY,
      size: subHeaderSize,
      font: fontBold,
      color: accentColor
    });

    companyY -= 18;
    page.drawText(s.companyName || storeName, {
      x: margin,
      y: companyY,
      size: subHeaderSize,
      font: fontBold,
      color: darkGray
    });

    // Company address
    const addressLines = [];
    if (s.companyAddress) addressLines.push(s.companyAddress);
    if (s.companyCity || s.companyPostcode) {
      const cityPostcode = [s.companyCity, s.companyPostcode].filter(Boolean).join(', ');
      if (cityPostcode) addressLines.push(cityPostcode);
    }
    if (s.companyCountry) addressLines.push(s.companyCountry);

    addressLines.forEach(line => {
      companyY -= 14;
      page.drawText(line, {
        x: margin,
        y: companyY,
        size: normalSize,
        font,
        color: mediumGray
      });
    });

    if (s.companyEmail) {
      companyY -= 14;
      page.drawText(`${s.companyEmail}`, {
        x: margin,
        y: companyY,
        size: normalSize,
        font,
        color: mediumGray
      });
    }

    if (s.companyPhone) {
      companyY -= 14;
      page.drawText(`${s.companyPhone}`, {
        x: margin,
        y: companyY,
        size: normalSize,
        font,
        color: mediumGray
      });
    }

    // Bill To section - center column
    const billToX = margin + 200;
    let billToY = yPos;

    page.drawText('Bill To:', {
      x: billToX,
      y: billToY,
      size: subHeaderSize,
      font: fontBold,
      color: accentColor
    });

    billToY -= 18;
    page.drawText(invoice.customerName, {
      x: billToX,
      y: billToY,
      size: subHeaderSize,
      font: fontBold,
      color: darkGray
    });

    if (invoice.customerEmail) {
      billToY -= 14;
      page.drawText(invoice.customerEmail, {
        x: billToX,
        y: billToY,
        size: normalSize,
        font,
        color: mediumGray
      });
    }

    // Items table
    yPos -= 120;

    // Table header
    const tableY = yPos;
    const rowHeight = 25;

    page.drawRectangle({
      x: margin,
      y: tableY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: primaryColor
    });

    // Column definitions with proper widths that fit the page
    const columns = [
      { label: 'Description', x: margin + 8, width: 240 },
      { label: 'Qty', x: margin + 258, width: 40 },
      { label: 'Rate', x: margin + 308, width: 60 },
      { label: s.taxLabel || 'VAT', x: margin + 378, width: 40 },
      { label: 'Amount', x: margin + 428, width: 85 }
    ];

    // Draw table headers
    columns.forEach(col => {
      if (col.label === 'Amount') {
        // Right-align the Amount header
        page.drawText(col.label, {
          x: col.x + col.width - font.widthOfTextAtSize(col.label, normalSize),
          y: tableY - 15,
          size: normalSize,
          font: fontBold,
          color: white
        });
      } else if (col.label === 'Qty' || col.label === (s.taxLabel || 'VAT')) {
        // Center-align Qty and VAT headers
        page.drawText(col.label, {
          x: col.x + (col.width - font.widthOfTextAtSize(col.label, normalSize)) / 2,
          y: tableY - 15,
          size: normalSize,
          font: fontBold,
          color: white
        });
      } else {
        // Left-align other headers
        page.drawText(col.label, {
          x: col.x,
          y: tableY - 15,
          size: normalSize,
          font: fontBold,
          color: white
        });
      }
    });

    let currentY = tableY - rowHeight;

    // Calculate totals with proper VAT handling
    let subtotal = 0;
    let totalVat = 0;
    const vatRate = (s.defaultTaxRate || 20) / 100;

    // Table rows
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        const itemVat = s.showTaxBreakdown ? itemTotal * vatRate : 0;
        subtotal += itemTotal;
        totalVat += itemVat;

        // Row background
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: index % 2 === 0 ? white : lightAccent,
          borderColor: lightGray,
          borderWidth: 0.5
        });

        // Truncate description if too long
        let description = item.name;
        const maxDescWidth = 220;
        while (font.widthOfTextAtSize(description, normalSize) > maxDescWidth && description.length > 10) {
          description = description.substring(0, description.length - 4) + '...';
        }

        // Draw cell contents with proper alignment
        page.drawText(description, {
          x: columns[0].x,
          y: currentY - 15,
          size: normalSize,
          font,
          color: darkGray
        });

        const qtyText = item.quantity.toString();
        page.drawText(qtyText, {
          x: columns[1].x + (columns[1].width - font.widthOfTextAtSize(qtyText, normalSize)) / 2,
          y: currentY - 15,
          size: normalSize,
          font,
          color: darkGray
        });

        page.drawText(`${s.currencySymbol || '£'}${item.price.toFixed(2)}`, {
          x: columns[2].x,
          y: currentY - 15,
          size: normalSize,
          font,
          color: darkGray
        });

        const vatText = s.showTaxBreakdown ? `${(s.defaultTaxRate || 20).toFixed(1)}%` : '-';
        page.drawText(vatText, {
          x: columns[3].x + (columns[3].width - font.widthOfTextAtSize(vatText, normalSize)) / 2,
          y: currentY - 15,
          size: normalSize,
          font,
          color: darkGray
        });

        const amountText = `${s.currencySymbol || '£'}${itemTotal.toFixed(2)}`;
        page.drawText(amountText, {
          x: columns[4].x + columns[4].width - font.widthOfTextAtSize(amountText, normalSize),
          y: currentY - 15,
          size: normalSize,
          font: fontBold,
          color: darkGray
        });

        currentY -= rowHeight;
      });
    } else {
      // No items message
      page.drawRectangle({
        x: margin,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: lightAccent
      });

      page.drawText('No items specified for this invoice.', {
        x: margin + contentWidth / 2 - font.widthOfTextAtSize('No items specified for this invoice.', normalSize) / 2,
        y: currentY - 15,
        size: normalSize,
        font: fontItalic,
        color: mediumGray
      });
      currentY -= rowHeight;
    }

    // Totals section with proper alignment
    currentY -= 30;
    const totalsX = margin + 350; // Move totals section to ensure it fits
    const totalsValueX = totalsX + 120; // Fixed position for values

    if (s.showTaxBreakdown && subtotal > 0) {
      // Subtotal
      page.drawText('Subtotal:', {
        x: totalsX,
        y: currentY,
        size: normalSize,
        font,
        color: darkGray
      });
      
      const subtotalText = `${s.currencySymbol || '£'}${subtotal.toFixed(2)}`;
      page.drawText(subtotalText, {
        x: totalsValueX + 60 - font.widthOfTextAtSize(subtotalText, normalSize),
        y: currentY,
        size: normalSize,
        font,
        color: darkGray
      });
      currentY -= 18;

      // VAT with proper label and percentage
      page.drawText(`${s.taxLabel || 'VAT'} (${(s.defaultTaxRate || 20).toFixed(1)}%):`, {
        x: totalsX,
        y: currentY,
        size: normalSize,
        font,
        color: darkGray
      });
      
      const vatText = `${s.currencySymbol || '£'}${totalVat.toFixed(2)}`;
      page.drawText(vatText, {
        x: totalsValueX + 60 - font.widthOfTextAtSize(vatText, normalSize),
        y: currentY,
        size: normalSize,
        font,
        color: darkGray
      });
      currentY -= 25;
    }

    // Total line
    page.drawLine({
      start: { x: totalsX, y: currentY + 8 },
      end: { x: totalsValueX + 60, y: currentY + 8 },
      thickness: 2,
      color: accentColor
    });

    page.drawText('TOTAL:', {
      x: totalsX,
      y: currentY - 10,
      size: headerSize,
      font: fontBold,
      color: accentColor
    });

    const finalTotal = s.showTaxBreakdown && subtotal > 0 ? subtotal + totalVat : invoice.amount;
    const totalText = `${s.currencySymbol || '£'}${finalTotal.toFixed(2)}`;
    page.drawText(totalText, {
      x: totalsValueX + 60 - fontBold.widthOfTextAtSize(totalText, headerSize),
      y: currentY - 10,
      size: headerSize,
      font: fontBold,
      color: accentColor
    });

    // Content sections (only add if they have meaningful content)
    let hasContentBelow = false;
    let contentStartY = currentY - 50;
    let currentContentY = contentStartY;

    // Payment instructions (only if not empty and meaningful)
    if (s.paymentInstructions && s.paymentInstructions.trim() && 
        s.paymentInstructions.trim() !== 'Please reference the invoice number when making payment.' &&
        s.paymentInstructions.trim().toLowerCase() !== 'none' &&
        s.paymentInstructions.trim().toLowerCase() !== 'n/a' &&
        s.paymentInstructions.trim().toLowerCase() !== '-') {
      hasContentBelow = true;
      page.drawText('Payment Instructions:', {
        x: margin,
        y: currentContentY,
        size: subHeaderSize,
        font: fontBold,
        color: accentColor
      });
      currentContentY -= 18;

      const instructions = s.paymentInstructions.split('\n');
      instructions.slice(0, 2).forEach(line => {
        if (line.trim()) {
          page.drawText(line.trim(), {
            x: margin,
            y: currentContentY,
            size: normalSize,
            font,
            color: darkGray
          });
          currentContentY -= 14;
        }
      });
      currentContentY -= 10; // Extra spacing after section
    }

    // Terms (only if not empty and meaningful)
    if (s.terms && s.terms.trim() && 
        s.terms.trim() !== 'Payment is due within 30 days of invoice date.' &&
        s.terms.trim().toLowerCase() !== 'yes' &&
        s.terms.trim().toLowerCase() !== 'none' &&
        s.terms.trim().toLowerCase() !== 'n/a' &&
        s.terms.trim().toLowerCase() !== '-') {
      hasContentBelow = true;
      page.drawText('Terms:', {
        x: margin,
        y: currentContentY,
        size: subHeaderSize,
        font: fontBold,
        color: accentColor
      });
      currentContentY -= 18;

      page.drawText(s.terms.trim(), {
        x: margin,
        y: currentContentY,
        size: smallSize,
        font,
        color: mediumGray
      });
      currentContentY -= 20; // Extra spacing after section
    }

    // Bank details (only if not empty and meaningful)
    if (s.bankDetails && s.bankDetails.trim() && 
        s.bankDetails.trim().toLowerCase() !== 'none' &&
        s.bankDetails.trim().toLowerCase() !== 'n/a' &&
        s.bankDetails.trim().toLowerCase() !== '-') {
      hasContentBelow = true;
      page.drawText('Bank Details:', {
        x: margin,
        y: currentContentY,
        size: subHeaderSize,
        font: fontBold,
        color: accentColor
      });
      currentContentY -= 18;

      const bankLines = s.bankDetails.split('\n');
      bankLines.slice(0, 3).forEach(line => {
        if (line.trim()) {
          page.drawText(line.trim(), {
            x: margin,
            y: currentContentY,
            size: normalSize,
            font,
            color: darkGray
          });
          currentContentY -= 14;
        }
      });
      currentContentY -= 10; // Extra spacing after section
    }

    // Digital signature at the bottom (only if not empty and it's actual text, not a blob URL)
    let footerY: number;
    if (hasContentBelow) {
      footerY = Math.max(currentContentY - 20, 120); // Reduced gap when content exists
    } else {
      footerY = Math.max(currentY - 40, 120); // Move footer closer to totals when no content
    }
    
    if (s.digitalSignature && s.digitalSignature.trim() && 
        !s.digitalSignature.startsWith('blob:') &&
        s.digitalSignature.trim().toLowerCase() !== 'none' &&
        s.digitalSignature.trim().toLowerCase() !== 'n/a' &&
        s.digitalSignature.trim().toLowerCase() !== '-') {
      page.drawText('Authorized Signature:', {
        x: pageWidth - margin - 200,
        y: footerY,
        size: smallSize,
        font: fontBold,
        color: mediumGray
      });
      
      // Handle multi-line signatures
      const signatureLines = s.digitalSignature.trim().split('\n');
      signatureLines.slice(0, 2).forEach((line, index) => {
        if (line.trim()) {
          page.drawText(line.trim(), {
            x: pageWidth - margin - 200,
            y: footerY - 15 - (index * 12),
            size: normalSize,
            font: fontItalic,
            color: accentColor
          });
        }
      });
      
      // Signature line
      page.drawLine({
        start: { x: pageWidth - margin - 200, y: footerY - 35 },
        end: { x: pageWidth - margin - 50, y: footerY - 35 },
        thickness: 1,
        color: mediumGray
      });
      
      footerY -= 45; // Adjust footer position
    }

    // Ensure footer doesn't go below minimum position but eliminate excessive space
    footerY = Math.max(footerY, 80);

    // Footer
    page.drawLine({
      start: { x: margin, y: footerY },
      end: { x: pageWidth - margin, y: footerY },
      thickness: 1,
      color: lightGray
    });

    page.drawText(`${s.companyName || storeName}`, {
      x: margin,
      y: footerY - 15,
      size: smallSize,
      font: fontBold,
      color: mediumGray
    });

    if (s.companyWebsite && s.companyWebsite.trim()) {
      page.drawText(s.companyWebsite, {
        x: pageWidth - margin - font.widthOfTextAtSize(s.companyWebsite, smallSize),
        y: footerY - 15,
        size: smallSize,
        font,
        color: mediumGray
      });
    }

    // Generate and download PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.companyName || storeName}-Invoice-${invoice.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                placeholder="Search invoices, customers..."
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
                        <div className="text-sm font-medium text-gray-900 truncate">{invoice.number}</div>
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


