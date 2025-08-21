import clientPromise from '@/lib/mongodb';
import { GoogleDriveService } from '@/lib/googleDriveService';

interface GoogleDriveConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiryDate?: number;
  folderId?: string;
  spreadsheetId?: string;
}

export interface BackupResult {
  success: boolean;
  backupId?: string;
  error?: string;
  totalDocuments?: number;
}

export interface BackupInfo {
  backupId: string;
  createdAt: string;
  totalDocuments: number;
  fileName: string;
  status: string;
}

export class SimpleBackupService {
  private userId: string;
  private driveService: GoogleDriveService | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initializeDriveService(): Promise<boolean> {
    try {
      // Get Google Drive configuration from database
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const configCollection = db.collection('googleDriveConfig');
      
      const config = await configCollection.findOne({ userId: this.userId });
      
      if (!config || !config.accessToken) {
        console.log('❌ Google Drive not configured for backup');
        return false;
      }
      
      this.driveService = new GoogleDriveService(config as GoogleDriveConfig, this.userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive service:', error);
      return false;
    }
  }

  async createBackup(): Promise<BackupResult> {
    console.log(`🔄 Starting backup for user: ${this.userId}`);

    try {
      // Initialize Google Drive service
      if (!await this.initializeDriveService()) {
        return { success: false, error: 'Google Drive not configured' };
      }

      // Connect to MongoDB
      const client = await clientPromise;
      const db = client.db('wooconnect');

      // Get all invoices for this user
      const invoicesCollection = db.collection('universalInvoices');
      const invoices = await invoicesCollection.find({ userId: this.userId }).toArray();

      console.log(`📊 Found ${invoices.length} invoices to backup`);

      if (invoices.length === 0) {
        return { success: false, error: 'No invoices found to backup' };
      }

      // Create backup data
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      const backupData = {
        metadata: {
          backupId,
          userId: this.userId,
          createdAt: timestamp,
          totalDocuments: invoices.length,
          type: 'invoices_backup'
        },
        invoices: invoices
      };

      // Convert to JSON and upload to Google Drive
      const backupJson = JSON.stringify(backupData, null, 2);
      const backupBuffer = Buffer.from(backupJson, 'utf-8');
      const fileName = `WooConnect_Invoices_Backup_${backupId}.json`;

      // Upload to Google Drive
      const uploadResult = await this.driveService!.uploadFile(
        fileName,
        backupBuffer,
        'application/json'
      );

      // Store backup metadata in database
      const backupMetadata = {
        userId: this.userId,
        backupId,
        fileName,
        driveFileId: uploadResult,
        createdAt: timestamp,
        totalDocuments: invoices.length,
        status: 'completed'
      };

      const backupsCollection = db.collection('invoiceBackups');
      await backupsCollection.insertOne(backupMetadata);

      // Clean up old backups (keep only 10 most recent)
      await this.cleanupOldBackups();

      console.log(`✅ Backup completed successfully: ${invoices.length} invoices backed up`);
      
      return { 
        success: true, 
        backupId,
        totalDocuments: invoices.length
      };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      // Get all backups for this user, sorted by creation date (oldest first)
      const allBackups = await backupsCollection
        .find({ userId: this.userId, status: 'completed' })
        .sort({ createdAt: 1 })
        .toArray();

      // If we have more than 10 backups, delete the oldest ones
      if (allBackups.length > 10) {
        const backupsToDelete = allBackups.slice(0, allBackups.length - 10);
        
        for (const backup of backupsToDelete) {
          try {
            // Delete from Google Drive first
            if (this.driveService && backup.driveFileId) {
              await this.driveService.drive.files.delete({ fileId: backup.driveFileId });
              console.log(`🗑️ Deleted old backup from Google Drive: ${backup.fileName}`);
            }

            // Delete from database
            await backupsCollection.deleteOne({ _id: backup._id });
            console.log(`🗑️ Deleted old backup from database: ${backup.backupId}`);

          } catch (error) {
            console.error(`❌ Error deleting old backup ${backup.backupId}:`, error);
          }
        }

        console.log(`✅ Cleanup completed. Maintained ${Math.min(allBackups.length, 10)} backups.`);
      }
    } catch (error) {
      console.error('❌ Error during backup cleanup:', error);
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      const backups = await backupsCollection
        .find({ userId: this.userId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      return backups.map(backup => ({
        backupId: backup.backupId,
        createdAt: backup.createdAt,
        totalDocuments: backup.totalDocuments,
        fileName: backup.fileName,
        status: backup.status
      }));
    } catch (error) {
      console.error('❌ Error listing backups:', error);
      return [];
    }
  }

  async getLastBackupTime(): Promise<number | null> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupsCollection = db.collection('invoiceBackups');

      const lastBackup = await backupsCollection
        .findOne(
          { userId: this.userId, status: 'completed' },
          { sort: { createdAt: -1 } }
        );

      return lastBackup ? new Date(lastBackup.createdAt).getTime() : null;
    } catch (error) {
      console.error('❌ Error getting last backup time:', error);
      return null;
    }
  }
}

// Simple backup scheduler
export class BackupScheduler {
  private static instance: BackupScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly BACKUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Backup scheduler is already running');
      return;
    }

    console.log('🚀 Starting backup scheduler (30-minute intervals)');
    this.isRunning = true;

    // Check immediately on startup
    await this.checkAndBackup();

    // Set up interval for future checks
    this.intervalId = setInterval(async () => {
      await this.checkAndBackup();
    }, this.BACKUP_INTERVAL);

    console.log('✅ Backup scheduler started successfully');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Backup scheduler stopped');
  }

  private async checkAndBackup(): Promise<void> {
    try {
      console.log('🔍 Checking if backup is needed...');

      // Get all users with Google Drive configured
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const configCollection = db.collection('googleDriveConfig');
      
      const usersWithDrive = await configCollection.find({}).toArray();
      console.log(`👥 Found ${usersWithDrive.length} users with Google Drive configured`);

      for (const userConfig of usersWithDrive) {
        const userId = userConfig.userId;
        const backupService = new SimpleBackupService(userId);
        
        // Check if backup is needed (30 minutes since last backup)
        const lastBackupTime = await backupService.getLastBackupTime();
        const now = Date.now();
        
        if (!lastBackupTime) {
          console.log(`⚡ No previous backup found for user ${userId} - creating first backup`);
          await this.performBackup(userId, backupService);
        } else {
          const timeSinceLastBackup = now - lastBackupTime;
          const minutesSinceLastBackup = Math.floor(timeSinceLastBackup / (60 * 1000));
          
          if (timeSinceLastBackup >= this.BACKUP_INTERVAL) {
            console.log(`⚡ Backup needed for user ${userId} (${minutesSinceLastBackup} minutes since last backup)`);
            await this.performBackup(userId, backupService);
          } else {
            const minutesLeft = 30 - minutesSinceLastBackup;
            console.log(`⏰ User ${userId}: Next backup in ${minutesLeft} minutes`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in backup scheduler check:', error);
    }
  }

  private async performBackup(userId: string, backupService: SimpleBackupService): Promise<void> {
    try {
      console.log(`🔄 Creating backup for user: ${userId}`);
      const result = await backupService.createBackup();
      
      if (result.success) {
        console.log(`✅ Backup successful for user ${userId}: ${result.totalDocuments} documents`);
      } else {
        console.log(`❌ Backup failed for user ${userId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error backing up user ${userId}:`, error);
    }
  }

  getStatus(): { running: boolean; nextCheck: string } {
    const nextCheckTime = this.isRunning 
      ? new Date(Date.now() + this.BACKUP_INTERVAL).toLocaleString()
      : 'Not scheduled';
      
    return {
      running: this.isRunning,
      nextCheck: nextCheckTime
    };
  }
}

// Export singleton instance
export const backupScheduler = BackupScheduler.getInstance();
