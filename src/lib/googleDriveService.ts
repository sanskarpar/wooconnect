import { google } from 'googleapis';
import clientPromise from '@/lib/mongodb';
import { Readable } from 'stream';

interface GoogleDriveConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiryDate?: number;
  folderId?: string;
  spreadsheetId?: string;
}

export class GoogleDriveService {
  private oauth2Client: any;
  public drive: any; // Made public for backup service access
  private sheets: any;
  public config: GoogleDriveConfig; // Made public for backup service access
  private userId: string;

  constructor(config: GoogleDriveConfig, userId: string) {
    this.config = config;
    this.userId = userId;
    
    // Use server-side Google API configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      throw new Error('Google API configuration missing from environment variables');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    if (config.accessToken) {
      this.oauth2Client.setCredentials({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
        expiry_date: config.tokenExpiryDate,
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  static async getConfigForUser(userId: string): Promise<GoogleDriveConfig | null> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const googleDriveConfigCollection = db.collection('googleDriveConfig');

      const config = await googleDriveConfigCollection.findOne({ userId });
      return config ? (config as unknown as GoogleDriveConfig) : null;
    } catch (error) {
      console.error('Error fetching Google Drive config:', error);
      return null;
    }
  }

  async uploadFile(fileName: string, fileContent: Buffer, mimeType: string): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Uploading file ${fileName} (attempt ${attempt}/${maxRetries})`);
        
        const fileMetadata = {
          name: fileName,
          parents: this.config.folderId ? [this.config.folderId] : undefined,
        };

        // Convert Buffer to a readable stream
        const stream = new Readable();
        stream.push(fileContent);
        stream.push(null); // End the stream

        const media = {
          mimeType,
          body: stream,
        };

        // Add timeout to the request
        const response = await Promise.race([
          this.drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id,name,webViewLink',
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 60000) // 60 second timeout
          )
        ]) as any;

        console.log(`✅ Successfully uploaded ${fileName}`);
        return response.data.webViewLink || response.data.id;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`❌ Upload attempt ${attempt} failed for ${fileName}:`, lastError.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 2000; // 2s, 4s, 8s delays
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to upload ${fileName} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async createTestFile(): Promise<string> {
    const testContent = Buffer.from('This is a test file from WooConnect Google Drive integration.', 'utf-8');
    const fileName = `WooConnect_Test_${new Date().toISOString().split('T')[0]}.txt`;
    
    return await this.uploadFile(fileName, testContent, 'text/plain');
  }

  async addInvoiceToSheet(invoiceData: any): Promise<void> {
    if (!this.config.spreadsheetId) {
      console.log('No spreadsheet ID configured, skipping sheet update');
      return;
    }

    try {
      // First, try to get the sheet to check if it exists
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
      });

      // Check if our sheet exists, if not create it
      let sheetName = 'WooConnect Invoices';
      const existingSheet = spreadsheet.data.sheets?.find(
        (sheet: any) => sheet.properties?.title === sheetName
      );

      if (!existingSheet) {
        // Create the sheet with headers
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });

        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `${sheetName}!A1:H1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              [
                'Universal Number',
                'Store Invoice Number',
                'Store Name',
                'Customer Name',
                'Customer Email',
                'Amount',
                'Status',
                'Created Date',
              ],
            ],
          },
        });
      }

      // Add the invoice data
      const values = [
        [
          invoiceData.universalNumber,
          invoiceData.storeInvoiceNumber,
          invoiceData.storeName,
          invoiceData.customerName,
          invoiceData.customerEmail || '',
          invoiceData.amount,
          invoiceData.status,
          new Date(invoiceData.createdAt).toLocaleDateString(),
        ],
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      console.log('Invoice added to Google Sheet successfully');
    } catch (error) {
      console.error('Error adding invoice to Google Sheet:', error);
      // Don't throw error here, as sheet sync is optional
    }
  }

  async updateTokens(userId: string, tokens: any): Promise<void> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const googleDriveConfigCollection = db.collection('googleDriveConfig');

      await googleDriveConfigCollection.updateOne(
        { userId },
        {
          $set: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiryDate: tokens.expiry_date,
            updatedAt: new Date().toISOString(),
          },
        }
      );
    } catch (error) {
      console.error('Error updating tokens:', error);
    }
  }

  async refreshAccessToken(userId: string): Promise<boolean> {
    try {
      if (!this.config.refreshToken) {
        return false;
      }

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (credentials.access_token) {
        await this.updateTokens(userId, credentials);
        this.oauth2Client.setCredentials(credentials);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  }

  async getSpreadsheetDownloadUrl(spreadsheetId: string): Promise<string> {
    try {
      // Generate a download URL for the spreadsheet as Excel format
      const downloadUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
      return downloadUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw error;
    }
  }

  async deleteAllInvoiceFiles(): Promise<{ deletedCount: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let deletedCount = 0;

      // Search for all PDF files in the configured folder that look like invoices
      const query = this.config.folderId 
        ? `'${this.config.folderId}' in parents and name contains 'Invoice_' and mimeType='application/pdf' and trashed=false`
        : `name contains 'Invoice_' and mimeType='application/pdf' and trashed=false`;

      console.log(`🔍 Searching for existing invoice files to delete...`);
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1000, // Get up to 1000 files
      });

      const files = response.data.files || [];
      console.log(`📁 Found ${files.length} existing invoice files to delete`);

      // Delete each file
      for (const file of files) {
        try {
          await this.drive.files.delete({
            fileId: file.id,
          });
          console.log(`🗑️ Deleted: ${file.name}`);
          deletedCount++;
        } catch (error) {
          const errorMsg = `Failed to delete ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`🧹 Cleanup complete: ${deletedCount} files deleted, ${errors.length} errors`);
      
      return { deletedCount, errors };
    } catch (error) {
      console.error('Error deleting invoice files from Google Drive:', error);
      throw error;
    }
  }
}

export async function uploadInvoiceToDrive(
  userId: string,
  fileName: string,
  pdfBuffer: Buffer,
  invoiceData: any
): Promise<{ driveLink?: string; error?: string }> {
  try {
    const config = await GoogleDriveService.getConfigForUser(userId);
    
    if (!config || !config.accessToken) {
      return { error: 'Google Drive not connected' };
    }

    const driveService = new GoogleDriveService(config, userId);
    
    // Try to upload, refresh token if needed
    try {
      const driveLink = await driveService.uploadFile(fileName, pdfBuffer, 'application/pdf');
      
      // Also add to sheet if configured
      await driveService.addInvoiceToSheet(invoiceData);
      
      return { driveLink };
    } catch (error: any) {
      if (error.code === 401) {
        // Token expired, try to refresh
        const refreshed = await driveService.refreshAccessToken(userId);
        if (refreshed) {
          const driveLink = await driveService.uploadFile(fileName, pdfBuffer, 'application/pdf');
          await driveService.addInvoiceToSheet(invoiceData);
          return { driveLink };
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error uploading invoice to Drive:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to upload newly synced invoices to Google Drive with duplicate prevention
export async function uploadNewInvoiceToDrive(userId: string, invoice: any, db: any): Promise<string | null> {
  try {
    // Check if invoice is already uploaded to prevent duplicates
    if (invoice.uploadedToDrive === true) {
      console.log(`Invoice ${invoice.universalNumber} already uploaded, skipping`);
      return null;
    }

    // Get settings for PDF generation
    const universalSettingsCollection = db.collection('universalInvoiceSettings');
    const settingsDoc = await universalSettingsCollection.findOne({ userId });
    const settings = settingsDoc?.settings || {};

    // Convert to InvoiceData format
    const invoiceData = {
      id: invoice.wooCommerceOrderId,
      number: invoice.storeInvoiceNumber,
      universalNumber: invoice.universalNumber,
      amount: invoice.amount,
      status: invoice.status,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      orderStatus: invoice.orderStatus,
      paymentMethod: invoice.paymentMethod,
      items: invoice.items || [],
      customerAddress: invoice.customerAddress || {},
    };

    // Import PDF generator
    const { downloadInvoicePDF } = await import('@/lib/invoicePdfGenerator');
    
    // Generate PDF
    const pdfBytes = await downloadInvoicePDF(invoiceData, settings, invoice.storeName);
    const pdfBuffer = Buffer.from(pdfBytes);

    // Upload to Drive
    const fileName = `Invoice_${invoice.universalNumber}_${invoice.storeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const uploadResult = await uploadInvoiceToDrive(userId, fileName, pdfBuffer, invoice);

    if (uploadResult.driveLink) {
      // Update invoice with Drive link and mark as uploaded
      const universalInvoicesCollection = db.collection('universalInvoices');
      await universalInvoicesCollection.updateOne(
        { universalNumber: invoice.universalNumber, userId },
        { 
          $set: { 
            driveLink: uploadResult.driveLink,
            uploadedToDrive: true,
            driveUploadedAt: new Date().toISOString(),
          }
        }
      );
      console.log(`Uploaded invoice ${invoice.universalNumber} to Google Drive`);
      return uploadResult.driveLink;
    } else {
      console.error(`Failed to upload invoice ${invoice.universalNumber}:`, uploadResult.error);
      return null;
    }
  } catch (error) {
    console.error(`Failed to upload invoice ${invoice.universalNumber} to Drive:`, error);
    return null;
  }
}
