import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface InvoiceData {
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
  paymentMethod?: string;
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

export interface InvoiceSettings {
  // Basic Info
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
  lateFeePercentage: number;
  discountType: 'percentage' | 'fixed';
  
  // Tax Settings
  defaultTaxRate: number;
  showTaxBreakdown: boolean;
  taxLabel: string;
  kleinunternehmerNote: string; // Custom note for Kleinunternehmer regulation
  
  // Currency & Formatting
  currencySymbol: string;
  dateFormat: string;
  numberFormat: string;
  
  // Additional Fields
  purchaseOrderRef: boolean;
  projectRef: boolean;
  deliveryDate: boolean;
  
  // Professional Features
  digitalSignature: string;
  approvedBy: string;
  invoiceStatus: boolean;
  showPaymentTerms: boolean;
  multiLanguage: boolean;
  language: string;
}

export const generateProfessionalUKInvoicePDF = async (
  invoice: InvoiceData, 
  settings: Partial<InvoiceSettings>,
  storeName?: string
): Promise<Uint8Array> => {
  // Map billingAddress to customerAddress if present
  if (!invoice.customerAddress && (invoice as any).billingAddress) {
    invoice.customerAddress = (invoice as any).billingAddress;
  }
  
  // Debug logging to see what address data we have
  console.log('Invoice address data:', {
    customerAddress: invoice.customerAddress,
    billingAddress: (invoice as any).billingAddress,
    customerName: invoice.customerName
  });
  // Default German invoice settings matching the actual settings interface
  const s: InvoiceSettings = {
    // Basic Info
    colorScheme: settings.colorScheme || '#000000',
    accentColor: settings.accentColor || '#000000',
    
    // Company Details
    companyName: settings.companyName || storeName || 'Max Mustermann',
    companyRegNumber: settings.companyRegNumber || '',
    vatNumber: settings.vatNumber || '122173244432',
    companyAddress: settings.companyAddress || 'Straße 232',
    companyCity: settings.companyCity || 'Berlin',
    companyPostcode: settings.companyPostcode || '10115',
    companyCountry: settings.companyCountry || '',
    companyEmail: settings.companyEmail || '',
    companyPhone: settings.companyPhone || '',
    companyWebsite: settings.companyWebsite || '',
    
    // Invoice Configuration
    invoicePrefix: settings.invoicePrefix || '',
    invoiceNumberFormat: settings.invoiceNumberFormat || '{YYYY} - {###}',
    lateFeePercentage: settings.lateFeePercentage || 0,
    discountType: settings.discountType || 'percentage',
    
    // Tax Settings
    defaultTaxRate: settings.defaultTaxRate || 0,
    showTaxBreakdown: false,
    taxLabel: settings.taxLabel || 'MwSt.',
    kleinunternehmerNote: settings.kleinunternehmerNote !== undefined ? settings.kleinunternehmerNote : 'Hinweis: Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird Umsatzsteuer nicht berechnet',
    
    // Currency & Formatting
    currencySymbol: settings.currencySymbol || '€',
    dateFormat: settings.dateFormat || 'DD.MM.YYYY',
    numberFormat: settings.numberFormat || 'DE',
    
    // Additional Fields
    purchaseOrderRef: false,
    projectRef: false,
    deliveryDate: true,
    
    // Professional Features
    digitalSignature: settings.digitalSignature || '',
    approvedBy: settings.approvedBy || '',
    invoiceStatus: false,
    showPaymentTerms: false,
    multiLanguage: false,
    language: 'de-DE'
  };

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  
  // Parse color scheme and accent colors from settings
  const parseColor = (colorHex: string) => {
    const hex = colorHex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return rgb(r, g, b);
  };
  
  const primaryColor = parseColor(s.colorScheme);
  const accentColor = parseColor(s.accentColor);
  const black = rgb(0, 0, 0);
  const lightGray = rgb(0.93, 0.94, 0.96);
  
  // Font sizes - using small size only
  const sizes = { title: 18, subtitle: 13, normal: 10, small: 9 };
  
  let yPos = pageHeight - margin - 20;

  // Company info in one line at the top
  const companyParts = [];
  if (s.companyName) companyParts.push(s.companyName);
  if (s.companyAddress) companyParts.push(s.companyAddress);
  if (s.companyPostcode && s.companyCity) companyParts.push(`${s.companyPostcode} ${s.companyCity}`);
  if (s.companyCountry) companyParts.push(s.companyCountry);
  
  if (companyParts.length > 0) {
    const companyLine = companyParts.join(', ');
    page.drawText(companyLine, {
      x: margin,
      y: yPos,
      size: sizes.normal,
      font,
      color: black
    });
    yPos -= 20;
  }

  // Customer address section
  yPos -= 10;
  page.drawText(invoice.customerName || 'Guest Customer', {
    x: margin,
    y: yPos,
    size: sizes.normal,
    font,
    color: black
  });
  yPos -= 15;
  
  // Debug: Show what address data we actually have
  console.log('Rendering buyer address:', invoice.customerAddress);
  
  // Customer Address Line 1
  if (invoice.customerAddress?.address_1) {
    page.drawText(invoice.customerAddress.address_1, {
      x: margin,
      y: yPos,
      size: sizes.normal,
      font,
      color: black
    });
    yPos -= 15;
  } else {
    console.log('No address_1 found in customerAddress');
  }
  
  // Customer Address Line 2 (if exists)
  if (invoice.customerAddress?.address_2) {
    page.drawText(invoice.customerAddress.address_2, {
      x: margin,
      y: yPos,
      size: sizes.normal,
      font,
      color: black
    });
    yPos -= 15;
  }
  
  // City, Postcode, State, Country
  const customerCityLine = [];
  if (invoice.customerAddress?.postcode) customerCityLine.push(invoice.customerAddress.postcode);
  if (invoice.customerAddress?.city) customerCityLine.push(invoice.customerAddress.city);
  if (invoice.customerAddress?.state) customerCityLine.push(invoice.customerAddress.state);
  if (invoice.customerAddress?.country) customerCityLine.push(invoice.customerAddress.country);
  if (customerCityLine.length > 0) {
    page.drawText(customerCityLine.join(', '), {
      x: margin,
      y: yPos,
      size: sizes.normal,
      font,
      color: black
    });
    yPos -= 15;
  }

  // Customer email
  if (invoice.customerEmail) {
    page.drawText(invoice.customerEmail, {
      x: margin,
      y: yPos,
      size: sizes.normal,
      font,
      color: black
    });
    yPos -= 15;
    // Add two line gaps below customer email
    yPos -= 30;
  }

  // Add gap before invoice section
  yPos -= 30;

  // Invoice title with custom color
  const titleText = 'Rechnung';
  
  page.drawText(titleText, {
    x: margin,
    y: yPos,
    size: sizes.title,
    font: fontBold,
    color: primaryColor
  });

  // Invoice number and dates
  yPos -= 30;
  // Draw invoice number directly - use universal number if available, fallback to regular number
  const invoiceDisplayNumber = invoice.universalNumber || invoice.number;
  page.drawText(invoiceDisplayNumber, {
    x: margin,
    y: yPos,
    size: sizes.subtitle,
    font: fontBold,
    color: accentColor
  });
  yPos -= 20;

  // Format dates based on settings
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (s.dateFormat === 'MM/DD/YYYY') {
      return date.toLocaleDateString('en-US');
    } else if (s.dateFormat === 'YYYY-MM-DD') {
      return date.toISOString().split('T')[0];
    } else {
      return date.toLocaleDateString('de-DE');
    }
  };

  const invoiceDate = formatDate(invoice.createdAt);

  // Tabulator alignment for labels and values
  const labelFont = fontBold;
  const labelSize = sizes.normal;
  const valueFont = font;
  const valueSize = sizes.normal;
  const labelTexts = [
    'Rechnungsdatum:',
    'Lieferdatum:',
    invoice.paymentMethod ? 'Zahlungsmethode:' : null
  ].filter(Boolean) as string[];
  const labelWidths = labelTexts.map(label =>
    labelFont.widthOfTextAtSize(label, labelSize)
  );
  const maxLabelWidth = Math.max(...labelWidths, 120); // fallback min width

  const labelX = margin;
  const valueX = labelX + maxLabelWidth + 10;

  // Rechnungsdatum
  page.drawText('Rechnungsdatum:', {
    x: labelX,
    y: yPos,
    size: labelSize,
    font: labelFont,
    color: black
  });
  page.drawText(invoiceDate, {
    x: valueX,
    y: yPos,
    size: valueSize,
    font: valueFont,
    color: black
  });
  yPos -= 15;

  // Lieferdatum
  page.drawText('Lieferdatum:', {
    x: labelX,
    y: yPos,
    size: labelSize,
    font: labelFont,
    color: black
  });
  page.drawText(invoiceDate, {
    x: valueX,
    y: yPos,
    size: valueSize,
    font: valueFont,
    color: black
  });
  yPos -= 15;

  // Zahlungsmethode
  if (invoice.paymentMethod) {
    page.drawText('Zahlungsmethode:', {
      x: labelX,
      y: yPos,
      size: labelSize,
      font: labelFont,
      color: black
    });
    page.drawText(invoice.paymentMethod, {
      x: valueX,
      y: yPos,
      size: valueSize,
      font: valueFont,
      color: black
    });
    yPos -= 15;
  }

  // Items Table
  yPos -= 40;
  
  // Table header
  const tableY = yPos;
  const rowHeight = 25;
  
  // Table header background using accent color
  page.drawRectangle({
    x: margin,
    y: tableY - rowHeight,
    width: contentWidth,
    height: rowHeight,
    color: lightGray
  });

  // Column definitions with German headers
  const columns = [
    { label: 'Pos', x: margin + 5, width: 30 },
    { label: 'Artikel', x: margin + 40, width: 250 },
    { label: 'Anzahl', x: margin + 300, width: 50 },
    { label: 'Preis', x: margin + 360, width: 60 },
    { label: 'Summe', x: margin + 430, width: 80 }
  ];

  // Draw table headers
  columns.forEach(col => {
    page.drawText(col.label, {
      x: col.x,
      y: tableY - 14,
      size: sizes.normal,
      font: fontBold,
      color: primaryColor
    });
  });

  let currentY = tableY - rowHeight;
  let subtotal = 0;
  let totalTax = 0;

  // Table rows
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item, index) => {
      currentY -= rowHeight;
      const lineTotal = item.quantity * item.price;
      subtotal += lineTotal;

      // Position
      page.drawText((index + 1).toString(), {
        x: columns[0].x,
        y: currentY + 8,
        size: sizes.small,
        font,
        color: black
      });

      // Article
      const articleName = item.name.length > 35 ? item.name.substring(0, 35) + '...' : item.name;
      page.drawText(articleName, {
        x: columns[1].x,
        y: currentY + 8,
        size: sizes.small,
        font,
        color: black
      });

      // Quantity
      page.drawText(item.quantity.toString(), {
        x: columns[2].x,
        y: currentY + 8,
        size: sizes.small,
        font,
        color: black
      });

      // Unit Price with currency formatting
      page.drawText(`${s.currencySymbol} ${item.price.toFixed(2).replace('.', ',')}`, {
        x: columns[3].x,
        y: currentY + 8,
        size: sizes.small,
        font,
        color: black
      });

      // Line Total with currency formatting
      page.drawText(`${s.currencySymbol} ${lineTotal.toFixed(2).replace('.', ',')}`, {
        x: columns[4].x,
        y: currentY + 8,
        size: sizes.small,
        font,
        color: black
      });
    });
  }

  // Totals Section
  currentY -= 50; // More space before totals
  const totalsX = margin + 350;

  // Subtotal
  page.drawText('Zwischensumme:', {
    x: totalsX,
    y: currentY,
    size: sizes.normal,
    font,
    color: black
  });

  page.drawText(`${s.currencySymbol} ${subtotal.toFixed(2).replace('.', ',')}`, {
    x: totalsX + 100,
    y: currentY,
    size: sizes.normal,
    font,
    color: black
  });

  currentY -= sizes.normal + 10; // Space after subtotal

  // Tax line
  const taxAmount = s.defaultTaxRate > 0 ? subtotal * (s.defaultTaxRate / 100) : 0;
  page.drawText(`${s.taxLabel || 'MwSt.'} (${s.defaultTaxRate}%)`, {
    x: totalsX,
    y: currentY,
    size: sizes.normal,
    font,
    color: black
  });

  page.drawText(`${s.currencySymbol} ${taxAmount.toFixed(2).replace('.', ',')}`, {
    x: totalsX + 100,
    y: currentY,
    size: sizes.normal,
    font,
    color: black
  });

  currentY -= sizes.subtitle + 10; // Space before grand total

  // Grand total includes tax
  const grandTotal = subtotal + taxAmount;

  page.drawText('Gesamtsumme:', {
    x: totalsX,
    y: currentY,
    size: sizes.normal,
    font: fontBold,
    color: primaryColor
  });

  page.drawText(`${s.currencySymbol} ${grandTotal.toFixed(2).replace('.', ',')}`, {
    x: totalsX + 100,
    y: currentY,
    size: sizes.normal,
    font: fontBold,
    color: primaryColor
  });

  // Footer and Tax Information
  currentY -= 60;
  
  // Only show the actual tax number (Steuernummer)
  if (s.vatNumber) {
    page.drawText(`Steuernummer: ${s.vatNumber}`, {
      x: margin,
      y: currentY,
      size: sizes.small,
      font,
      color: black
    });
    currentY -= 15;
  }

  // Digital signature if provided
  // Removed digital signature and 'Genehmigt von' rendering as requested

  // Authorized by if different from digital signature
  if (s.approvedBy && s.approvedBy !== s.digitalSignature) {
    currentY -= 20;
    page.drawText('Autorisiert von:', {
      x: margin,
      y: currentY,
      size: sizes.small,
      font,
      color: black
    });
    currentY -= 15;
    
    page.drawText(s.approvedBy, {
      x: margin,
      y: currentY,
      size: sizes.normal,
      font: fontBold,
      color: primaryColor
    });
    currentY -= 30; // Extra gap before Kleinunternehmer note
    
    // Kleinunternehmer note below authorized by
    if (s.kleinunternehmerNote && s.kleinunternehmerNote.trim()) {
      page.drawText(s.kleinunternehmerNote, {
        x: margin,
        y: currentY,
        size: sizes.small,
        font,
        color: black,
        maxWidth: contentWidth
      });
      currentY -= 15;
    }
  }

  // Footer: center-aligned, visually appealing
  let footerY = 40;
  let footerText = '';
  if (s.companyEmail) {
    footerText += s.companyEmail;
  }
  if (s.companyPhone) {
    if (footerText) footerText += '  |  ';
    footerText += s.companyPhone;
  }
  if (s.companyWebsite) {
    if (footerText) footerText += '  |  ';
    footerText += s.companyWebsite;
  }
  // Add custom footer text if provided - removed s.footerText since not in interface
  if (footerText) {
    // Calculate text width for centering
    const textWidth = font.widthOfTextAtSize(footerText, sizes.normal);
    const centerX = (pageWidth - textWidth) / 2;
    page.drawText(footerText, {
      x: centerX,
      y: footerY,
      size: sizes.normal,
      font,
      color: accentColor,
      lineHeight: 14,
      maxWidth: contentWidth
    });
  }

  return await pdfDoc.save();
};

export const downloadInvoicePDF = async (
  invoice: InvoiceData,
  settings: Partial<InvoiceSettings>,
  storeName?: string
) => {
  const pdfBytes = await generateProfessionalUKInvoicePDF(invoice, settings, storeName);
  // Just return the PDF bytes for further processing (e.g., zipping)
  return pdfBytes;
};

export const getSampleInvoiceData = (): InvoiceData => ({
  id: 'sample-1',
  number: '2020 - 125',
  universalNumber: '2025-01', // Universal invoice number for sample
  amount: 25.33,
  status: 'unpaid',
  customerName: 'Dyana Reicheneder',
  customerEmail: 'dyana@example.de',
  createdAt: '2021-01-05T00:00:00.000Z',
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  paymentMethod: 'PayPal',
  customerAddress: {
    address_1: 'Mühlbaurstr. 7',
    address_2: '',
    city: 'München',
    postcode: '81677',
    country: 'DE',
    state: 'Bayern',
  },
  items: [
    { name: 'Seidenstrauß Rosen mondweiß', quantity: 1, price: 15.00 },
    { name: 'Seidenstrauß Rosen bordeaux', quantity: 1, price: 12.33 },
    { name: 'Rabatt', quantity: 1, price: -2.00 }
  ]
});
