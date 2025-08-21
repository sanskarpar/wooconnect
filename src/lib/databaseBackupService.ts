import { google } from 'googleapis';
import clientPromise from '@/lib/mongodb';
import { GoogleDriveService } from '@/lib/googleDriveService';
import { ObjectId } from 'mongodb';

interface BackupMetadata {
  _id?: any;
  userId: string;
  backupId: string;
  createdAt: string;
  invoiceCount: number;
  fileSize: number;
  driveFileId: string;
  driveFileName: string;
  driveLink: string;
  backupType: 'automatic' | 'manual';
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

interface InvoiceBackupData {
  backupMetadata: {
    createdAt: string;
    backupId: string;
    userId: string;
    invoiceCount: number;
    backupType: 'automatic' | 'manual';
    version: string;
  };
  invoices: any[];
}

export class DatabaseBackupService {
  private userId: string;
  private driveService: GoogleDriveService | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initializeDriveService(): Promise<GoogleDriveService | null> {
    try {
      const config = await GoogleDriveService.getConfigForUser(this.userId);
      if (!config || !config.accessToken) {
        console.log(`Google Drive not connected for user ${this.userId}`);
        return null;
      }
      
      this.driveService = new GoogleDriveService(config, this.userId);
      return this.driveService;
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      return null;
    }
  }

  /**
   * Create a manual backup of user's invoices
   */
  async createManualBackup(): Promise<{ success: boolean; backupId?: string; message: string; driveLink?: string }> {
    return this.createBackup('manual');
  }

  /**
   * Create an automatic backup (called by scheduler)
   */
  async createAutomaticBackup(): Promise<{ success: boolean; backupId?: string; message: string }> {
    const result = await this.createBackup('automatic');
    return {
      success: result.success,
      backupId: result.backupId,
      message: result.message
    };
  }

  /**
   * Core backup creation method
   */
  private async createBackup(backupType: 'automatic' | 'manual'): Promise<{ success: boolean; backupId?: string; message: string; driveLink?: string }> {
    try {
      // Initialize Google Drive service
      const driveService = await this.initializeDriveService();
      if (!driveService) {
        return {
          success: false,
          message: 'Google Drive not connected. Please connect Google Drive to enable backups.'
        };
      }

      // Generate backup ID
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Get all invoices for this user
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const universalInvoicesCollection = db.collection('universalInvoices');
      
      const invoices = await universalInvoicesCollection
        .find({ userId: this.userId })
        .sort({ createdAt: -1 })
        .toArray();

      if (invoices.length === 0) {
        console.log(`No invoices found for user ${this.userId}, creating empty backup`);
        // Still create backup but with empty invoices array
      }

      // Clean up invoice data (remove sensitive internal fields)
      const cleanInvoices = invoices.map(invoice => {
        const { _id, ...cleanInvoice } = invoice;
        return {
          ...cleanInvoice,
          id: _id.toString() // Convert ObjectId to string for JSON serialization
        };
      });

      // Create backup data structure
      const backupData: InvoiceBackupData = {
        backupMetadata: {
          createdAt: timestamp,
          backupId,
          userId: this.userId,
          invoiceCount: invoices.length,
          backupType,
          version: '1.0'
        },
        invoices: cleanInvoices
      };

      // Convert to JSON buffer with proper formatting
      const jsonString = JSON.stringify(backupData, null, 2);
      
      // Validate JSON before uploading
      try {
        JSON.parse(jsonString);
      } catch (validateError) {
        console.error('Generated JSON is invalid:', validateError);
        return {
          success: false,
          message: 'Failed to create valid backup JSON.'
        };
      }
      
      const jsonBuffer = Buffer.from(jsonString, 'utf-8');

      // Create filename
      const fileName = `WooConnect_InvoiceBackup_${backupId}_${new Date().toISOString().split('T')[0]}.json`;

      try {
        // Upload to Google Drive
        const driveLink = await driveService.uploadFile(fileName, jsonBuffer, 'application/json');

        // Get file ID from drive link for storage
        const driveFileId = this.extractFileIdFromDriveLink(driveLink);

        // Store backup metadata in database
        const backupMetadata: BackupMetadata = {
          userId: this.userId,
          backupId,
          createdAt: timestamp,
          invoiceCount: invoices.length,
          fileSize: jsonBuffer.length,
          driveFileId,
          driveFileName: fileName,
          driveLink,
          backupType,
          status: 'completed'
        };

        const backupsCollection = db.collection('invoiceBackups');
        await backupsCollection.insertOne(backupMetadata);

        // Clean up old backups (keep only 5 most recent)
        if (invoices.length > 0) {
          await this.cleanupOldBackups();
        }

        console.log(`✅ ${backupType} backup created successfully for user ${this.userId}: ${backupId}`);

        return {
          success: true,
          backupId,
          message: `${backupType === 'manual' ? 'Manual' : 'Automatic'} backup created successfully. ${invoices.length} invoices backed up.`,
          driveLink: backupType === 'manual' ? driveLink : undefined
        };

      } catch (driveError: any) {
        // Handle Google Drive upload errors (token refresh, etc.)
        if (driveError.code === 401) {
          const refreshed = await driveService.refreshAccessToken(this.userId);
          if (refreshed) {
            // Retry upload after token refresh
            const driveLink = await driveService.uploadFile(fileName, jsonBuffer, 'application/json');
            const driveFileId = this.extractFileIdFromDriveLink(driveLink);

            const backupMetadata: BackupMetadata = {
              userId: this.userId,
              backupId,
              createdAt: timestamp,
              invoiceCount: invoices.length,
              fileSize: jsonBuffer.length,
              driveFileId,
              driveFileName: fileName,
              driveLink,
              backupType,
              status: 'completed'
            };

            const backupsCollection = db.collection('invoiceBackups');
            await backupsCollection.insertOne(backupMetadata);
            if (invoices.length > 0) {
              await this.cleanupOldBackups();
            }

            return {
              success: true,
              backupId,
              message: `${backupType === 'manual' ? 'Manual' : 'Automatic'} backup created successfully after token refresh. ${invoices.length} invoices backed up.`,
              driveLink: backupType === 'manual' ? driveLink : undefined
            };
          }
        }
        throw driveError;
      }

    } catch (error) {
      console.error(`Failed to create ${backupType} backup for user ${this.userId}:`, error);
      
      // Store failed backup metadata
      try {
        const client = await clientPromise;
        const db = client.db('wooconnect');
        const backupsCollection = db.collection('invoiceBackups');
        
        const failedBackupMetadata: BackupMetadata = {
          userId: this.userId,
          backupId: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          invoiceCount: 0,
          fileSize: 0,
          driveFileId: '',
          driveFileName: '',
          driveLink: '',
          backupType,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };

        await backupsCollection.insertOne(failedBackupMetadata);
      } catch (metadataError) {
        console.error('Failed to store failed backup metadata:', metadataError);
      }

      return {
        success: false,
        message: `Failed to create ${backupType} backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get list of all backups for the user
   */
  async getBackupList(): Promise<BackupMetadata[]> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      const backups = await backupsCollection
        .find({ userId: this.userId })
        .sort({ createdAt: -1 })
        .toArray();

      return backups.map(backup => ({
        ...backup,
        _id: backup._id.toString()
      })) as BackupMetadata[];
    } catch (error) {
      console.error('Failed to get backup list:', error);
      return [];
    }
  }

  /**
   * Restore invoices from a specific backup
   */
  async restoreFromBackup(backupId: string): Promise<{ success: boolean; message: string; restoredCount?: number }> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      // Find the backup metadata
      const backupMetadata = await backupsCollection.findOne({
        userId: this.userId,
        backupId,
        status: 'completed'
      });

      if (!backupMetadata) {
        return {
          success: false,
          message: 'Backup not found or not completed successfully.'
        };
      }

      // Initialize Google Drive service
      const driveService = await this.initializeDriveService();
      if (!driveService) {
        return {
          success: false,
          message: 'Google Drive not connected. Cannot restore backup.'
        };
      }

      // Download backup file from Google Drive
      const backupFileContent = await this.downloadBackupFile(driveService, backupMetadata.driveFileId);
      if (!backupFileContent) {
        return {
          success: false,
          message: 'Failed to download backup file from Google Drive.'
        };
      }

      // Parse backup data with better error handling
      let backupData: InvoiceBackupData;
      try {
        backupData = JSON.parse(backupFileContent);
      } catch (parseError) {
        console.error('Failed to parse backup JSON:', parseError);
        console.error('File content:', backupFileContent.substring(0, 500));
        return {
          success: false,
          message: 'Backup file is corrupted or not valid JSON format.'
        };
      }
      
      if (!backupData.invoices || !Array.isArray(backupData.invoices)) {
        return {
          success: false,
          message: 'Invalid backup data format.'
        };
      }

      // Create a restoration timestamp
      const restorationTimestamp = new Date().toISOString();

      // Prepare invoices for restoration (convert string IDs back to ObjectId for MongoDB)
      const invoicesToRestore = backupData.invoices.map(invoice => {
        const { id, ...invoiceData } = invoice;
        return {
          ...invoiceData,
          restoredAt: restorationTimestamp,
          restoredFromBackup: backupId,
          lastUpdated: restorationTimestamp
        };
      });

      // Clear existing invoices and restore from backup
      const universalInvoicesCollection = db.collection('universalInvoices');
      
      // First, backup current state before restoration
      await this.createBackup('manual'); // Create a safety backup before restoration
      
      // Delete existing invoices for this user
      const deleteResult = await universalInvoicesCollection.deleteMany({ userId: this.userId });
      console.log(`Deleted ${deleteResult.deletedCount} existing invoices before restoration`);

      // Insert restored invoices
      if (invoicesToRestore.length > 0) {
        const insertResult = await universalInvoicesCollection.insertMany(invoicesToRestore);
        console.log(`Restored ${insertResult.insertedCount} invoices from backup ${backupId}`);

        return {
          success: true,
          message: `Successfully restored ${insertResult.insertedCount} invoices from backup created on ${new Date(backupMetadata.createdAt).toLocaleString()}.`,
          restoredCount: insertResult.insertedCount
        };
      } else {
        return {
          success: false,
          message: 'No invoices found in backup to restore.'
        };
      }

    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return {
        success: false,
        message: `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Download backup file content from Google Drive
   */
  private async downloadBackupFile(driveService: GoogleDriveService, fileId: string): Promise<string | null> {
    try {
      // Try different methods to download the file
      let response;
      
      try {
        // First try with responseType text
        response = await driveService.drive.files.get({
          fileId: fileId,
          alt: 'media'
        }, {
          responseType: 'text'
        });
      } catch (error) {
        // Fallback to default responseType
        response = await driveService.drive.files.get({
          fileId: fileId,
          alt: 'media'
        });
      }

      // Handle different response data types
      let fileContent = response.data;
      
      if (typeof fileContent === 'string') {
        return fileContent;
      } else if (fileContent && typeof fileContent === 'object') {
        // If it's already an object, stringify it
        return JSON.stringify(fileContent);
      } else if (Buffer.isBuffer(fileContent)) {
        // If it's a buffer, convert to string
        return fileContent.toString('utf-8');
      } else {
        // Last resort - convert to string
        return String(fileContent);
      }

    } catch (error) {
      console.error('Failed to download backup file:', error);
      return null;
    }
  }

  /**
   * Delete old backups keeping only the 5 most recent ones
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      // Get all backups for this user, sorted by creation date (newest first)
      const allBackups = await backupsCollection
        .find({ 
          userId: this.userId, 
          status: 'completed' 
        })
        .sort({ createdAt: -1 })
        .toArray();

      // If we have more than 5 backups, delete the oldest ones
      if (allBackups.length > 5) {
        const backupsToDelete = allBackups.slice(5); // Get backups beyond the first 5
        
        const driveService = await this.initializeDriveService();
        
        for (const backup of backupsToDelete) {
          try {
            // Delete from Google Drive
            if (driveService && backup.driveFileId) {
              await driveService.drive.files.delete({
                fileId: backup.driveFileId
              });
              console.log(`Deleted old backup file from Google Drive: ${backup.driveFileName}`);
            }

            // Delete from database
            await backupsCollection.deleteOne({ _id: backup._id });
            console.log(`Deleted old backup metadata: ${backup.backupId}`);
          } catch (error) {
            console.error(`Failed to delete old backup ${backup.backupId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Extract file ID from Google Drive share link
   */
  private extractFileIdFromDriveLink(driveLink: string): string {
    const match = driveLink.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : '';
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    lastBackupDate: string | null;
    totalInvoicesInLastBackup: number;
    automaticBackups: number;
    manualBackups: number;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      const backups = await backupsCollection
        .find({ 
          userId: this.userId, 
          status: 'completed' 
        })
        .sort({ createdAt: -1 })
        .toArray();

      const automaticBackups = backups.filter(b => b.backupType === 'automatic').length;
      const manualBackups = backups.filter(b => b.backupType === 'manual').length;

      return {
        totalBackups: backups.length,
        lastBackupDate: backups.length > 0 ? backups[0].createdAt : null,
        totalInvoicesInLastBackup: backups.length > 0 ? backups[0].invoiceCount : 0,
        automaticBackups,
        manualBackups
      };
    } catch (error) {
      console.error('Failed to get backup stats:', error);
      return {
        totalBackups: 0,
        lastBackupDate: null,
        totalInvoicesInLastBackup: 0,
        automaticBackups: 0,
        manualBackups: 0
      };
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      const backup = await backupsCollection.findOne({
        userId: this.userId,
        backupId
      });

      if (!backup) {
        return {
          success: false,
          message: 'Backup not found.'
        };
      }

      const driveService = await this.initializeDriveService();
      
      // Delete from Google Drive
      if (driveService && backup.driveFileId) {
        try {
          await driveService.drive.files.delete({
            fileId: backup.driveFileId
          });
        } catch (error) {
          console.error('Failed to delete from Google Drive:', error);
          // Continue with database deletion even if Drive deletion fails
        }
      }

      // Delete from database
      await backupsCollection.deleteOne({ _id: backup._id });

      return {
        success: true,
        message: 'Backup deleted successfully.'
      };
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return {
        success: false,
        message: `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Static method to create automatic backups for all users with Google Drive connected
 */
export async function createAutomaticBackupsForAllUsers(): Promise<void> {
  try {
    console.log('🔄 Starting automatic backup process for all users...');
    
    const client = await clientPromise;
    const db = client.db('wooconnect');
    const googleDriveConfigCollection = db.collection('googleDriveConfig');

    // Get all users who have Google Drive connected
    const usersWithDrive = await googleDriveConfigCollection
      .find({ accessToken: { $exists: true, $ne: null } })
      .toArray();

    console.log(`Found ${usersWithDrive.length} users with Google Drive connected`);

    const results = [];
    
    for (const userConfig of usersWithDrive) {
      try {
        const backupService = new DatabaseBackupService(userConfig.userId);
        const result = await backupService.createAutomaticBackup();
        
        results.push({
          userId: userConfig.userId,
          success: result.success,
          message: result.message,
          backupId: result.backupId
        });

        if (result.success) {
          console.log(`✅ Automatic backup successful for user ${userConfig.userId}: ${result.backupId}`);
        } else {
          console.log(`❌ Automatic backup failed for user ${userConfig.userId}: ${result.message}`);
        }
      } catch (error) {
        console.error(`Failed to create automatic backup for user ${userConfig.userId}:`, error);
        results.push({
          userId: userConfig.userId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          backupId: undefined
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`🎯 Automatic backup process completed: ${successCount} successful, ${failCount} failed`);
  } catch (error) {
    console.error('Failed to run automatic backup process:', error);
  }
}
