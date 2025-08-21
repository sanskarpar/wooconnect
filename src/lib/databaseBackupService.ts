import { google } from 'googleapis';
import clientPromise from '@/lib/mongodb';
import { Readable } from 'stream';
import { GoogleDriveService } from '@/lib/googleDriveService';
import { ObjectId } from 'mongodb';

export interface DatabaseBackup {
  timestamp: string;
  collections: {
    [collectionName: string]: any[];
  };
  metadata: {
    backupId: string;
    createdAt: string;
    totalDocuments: number;
    collections: string[];
  };
}

export class DatabaseBackupService {
  private userId: string;
  private driveService: GoogleDriveService | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initializeDriveService(): Promise<boolean> {
    try {
      const config = await GoogleDriveService.getConfigForUser(this.userId);
      if (!config || !config.accessToken) {
        console.log(`No Google Drive config found for user ${this.userId}`);
        return false;
      }

      this.driveService = new GoogleDriveService(config, this.userId);
      return true;
    } catch (error) {
      console.error('Error initializing Google Drive service:', error);
      return false;
    }
  }

  async createDatabaseBackup(): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      if (!await this.initializeDriveService()) {
        return { success: false, error: 'Google Drive not configured' };
      }

      console.log(`🔄 Starting database backup for user ${this.userId}`);
      
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Get all collections for this user
      const collections = await db.listCollections().toArray();
      const backup: DatabaseBackup = {
        timestamp: new Date().toISOString(),
        collections: {},
        metadata: {
          backupId: `backup_${this.userId}_${Date.now()}`,
          createdAt: new Date().toISOString(),
          totalDocuments: 0,
          collections: []
        }
      };

      let totalDocuments = 0;

      // Define all possible user collections (including ones that might not exist yet)
      const userSpecificCollections = [
        'googleDriveConfig',
        'universalInvoices', 
        'universalInvoiceSettings',
        'storeSettings',
        'invoiceSettings',
        'invoiceBlacklist'
      ];

      // Get existing collection names
      const existingCollections = collections.map(c => c.name);
      
      // Backup all user-specific collections (whether they exist in listCollections or not)
      const collectionsToCheck = [...new Set([...existingCollections, ...userSpecificCollections, 'users'])];

      console.log(`📋 Collections to check: ${collectionsToCheck.join(', ')}`);

      // Backup each collection
      for (const collectionName of collectionsToCheck) {
        console.log(`📦 Backing up collection: ${collectionName}`);
        
        const collection = db.collection(collectionName);
        
        let documents;
        if (userSpecificCollections.includes(collectionName)) {
          documents = await collection.find({ userId: this.userId }).toArray();
          console.log(`  Found ${documents.length} documents for user ${this.userId} in ${collectionName}`);
          
          // Special logging for universalInvoiceSettings
          if (collectionName === 'universalInvoiceSettings') {
            console.log(`  🎯 Universal Invoice Settings Details:`, {
              userId: this.userId,
              documentCount: documents.length,
              documentIds: documents.map(d => d._id),
              sampleData: documents.length > 0 ? documents[0] : 'No data'
            });
          }
        } else if (collectionName === 'users') {
          // For users collection, handle _id as either string or ObjectId
          documents = await collection.find({ _id: this.userId } as any).toArray();
          console.log(`  Found ${documents.length} user documents for ${this.userId}`);
        } else {
          // Skip system collections and collections that don't belong to this user
          console.log(`  Skipping system collection: ${collectionName}`);
          continue;
        }

        // Only add to backup if we found documents or if it's a user-specific collection
        if (documents.length > 0 || userSpecificCollections.includes(collectionName)) {
          backup.collections[collectionName] = documents;
          totalDocuments += documents.length;
          backup.metadata.collections.push(collectionName);
          
          console.log(`✅ Backed up ${documents.length} documents from ${collectionName}`);
        } else {
          console.log(`⏭️ Skipped empty non-user collection: ${collectionName}`);
        }
      }

      backup.metadata.totalDocuments = totalDocuments;

      // Convert backup to JSON and upload to Google Drive
      const backupJson = JSON.stringify(backup, null, 2);
      const backupBuffer = Buffer.from(backupJson, 'utf-8');
      
      const fileName = `WooConnect_Database_Backup_${backup.metadata.backupId}.json`;
      
      const uploadResult = await this.driveService!.uploadFile(
        fileName,
        backupBuffer,
        'application/json'
      );

      console.log(`✅ Database backup completed: ${totalDocuments} documents backed up`);
      console.log(`🔗 Backup uploaded to Google Drive: ${uploadResult}`);

      // Store backup metadata in database
      const backupMetadataCollection = db.collection('databaseBackups');
      await backupMetadataCollection.insertOne({
        userId: this.userId,
        backupId: backup.metadata.backupId,
        fileName,
        driveLink: uploadResult,
        createdAt: backup.metadata.createdAt,
        totalDocuments: backup.metadata.totalDocuments,
        collections: backup.metadata.collections,
        status: 'completed'
      });

      // Clean up old backups (keep only 5 most recent)
      await this.cleanupOldBackups();

      return { 
        success: true, 
        backupId: backup.metadata.backupId 
      };

    } catch (error) {
      console.error('Error creating database backup:', error);
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
      const backupMetadataCollection = db.collection('databaseBackups');
      
      // Get all backups for this user, sorted by creation date (newest first)
      const allBackups = await backupMetadataCollection
        .find({ userId: this.userId, status: 'completed' })
        .sort({ createdAt: -1 })
        .toArray();

      // If we have more than 5 backups, delete the oldest ones
      if (allBackups.length > 5) {
        const backupsToDelete = allBackups.slice(5); // Keep first 5, delete the rest
        
        console.log(`🧹 Found ${allBackups.length} backups for user ${this.userId}. Cleaning up ${backupsToDelete.length} oldest backups to maintain 5-backup limit.`);

        for (const oldBackup of backupsToDelete) {
          try {
            // Delete from Google Drive first
            if (this.driveService) {
              const query = this.driveService.config.folderId
                ? `'${this.driveService.config.folderId}' in parents and name='${oldBackup.fileName}' and trashed=false`
                : `name='${oldBackup.fileName}' and trashed=false`;

              const response = await this.driveService.drive.files.list({
                q: query,
                fields: 'files(id, name)',
                pageSize: 10
              });

              const files = response.data.files || [];
              for (const file of files) {
                if (file.id) {
                  await this.driveService.drive.files.delete({ fileId: file.id });
                  console.log(`🗑️ Deleted old backup file from Google Drive: ${oldBackup.fileName}`);
                }
              }
            }

            // Delete from database
            await backupMetadataCollection.deleteOne({ _id: oldBackup._id });
            console.log(`🗑️ Deleted old backup from database: ${oldBackup.backupId}`);

          } catch (error) {
            console.error(`❌ Error deleting old backup ${oldBackup.backupId}:`, error);
          }
        }

        console.log(`✅ Cleanup completed. Now maintaining ${Math.min(allBackups.length, 5)} backups.`);
      }
    } catch (error) {
      console.error('❌ Error during backup cleanup:', error);
    }
  }

  async listAvailableBackups(): Promise<any[]> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupMetadataCollection = db.collection('databaseBackups');
      
      // Get backups sorted by creation date (newest first) and limit to 5
      const backups = await backupMetadataCollection
        .find({ userId: this.userId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  async restoreFromGoogleDrive(backupId: string): Promise<{ success: boolean; error?: string; restored?: number }> {
    try {
      if (!await this.initializeDriveService()) {
        return { success: false, error: 'Google Drive not configured' };
      }

      console.log(`🔄 Starting database restore from backup ${backupId}`);

      // First, get backup metadata from database
      const client = await clientPromise;
      const db = client.db('wooconnect');
      const backupMetadataCollection = db.collection('databaseBackups');
      
      const backupMetadata = await backupMetadataCollection.findOne({
        userId: this.userId,
        backupId,
        status: 'completed'
      });

      if (!backupMetadata) {
        return { success: false, error: 'Backup not found' };
      }

      // Find the backup file in Google Drive by searching for the filename
      const query = this.driveService!.config.folderId
        ? `'${this.driveService!.config.folderId}' in parents and name='${backupMetadata.fileName}' and mimeType='application/json' and trashed=false`
        : `name='${backupMetadata.fileName}' and mimeType='application/json' and trashed=false`;

      const response = await this.driveService!.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1
      });

      const files = response.data.files || [];
      if (files.length === 0) {
        return { success: false, error: 'Backup file not found in Google Drive' };
      }

      // Download the backup file with proper handling
      const fileId = files[0].id;
      
      // Use a different approach - get as text/plain to ensure we get the raw JSON
      const fileResponse = await this.driveService!.drive.files.get({
        fileId,
        alt: 'media'
      });

      console.log('File response type:', typeof fileResponse.data);
      
      let backupDataString: string;
      
      // Handle different data types from Google Drive API
      if (typeof fileResponse.data === 'string') {
        backupDataString = fileResponse.data;
      } else if (Buffer.isBuffer(fileResponse.data)) {
        backupDataString = fileResponse.data.toString('utf-8');
      } else if (fileResponse.data && typeof fileResponse.data === 'object') {
        // If it's already parsed as an object, stringify and re-parse it
        backupDataString = JSON.stringify(fileResponse.data);
      } else {
        console.error('Unexpected file data type:', typeof fileResponse.data);
        console.error('File data:', fileResponse.data);
        return { success: false, error: 'Invalid file data received from Google Drive' };
      }

      let backupData: DatabaseBackup;
      try {
        backupData = JSON.parse(backupDataString);
      } catch (parseError) {
        console.error('Failed to parse backup JSON:', parseError);
        console.log('Data string preview:', backupDataString.substring(0, 200));
        return { success: false, error: 'Invalid backup file format - not valid JSON' };
      }
      
      console.log(`📦 Restoring backup from ${backupData.metadata.createdAt}`);
      console.log(`📊 Total documents to restore: ${backupData.metadata.totalDocuments}`);

      let restoredDocuments = 0;

      // Define the same user-specific collections list for consistency
      const userSpecificCollections = [
        'googleDriveConfig',
        'universalInvoices',
        'universalInvoiceSettings', 
        'storeSettings',
        'invoiceSettings',
        'invoiceBlacklist'
      ];

      // Restore each collection
      for (const [collectionName, documents] of Object.entries(backupData.collections)) {
        const documentArray = documents as any[];
        if (!documentArray || documentArray.length === 0) continue;

        console.log(`🔄 Restoring collection: ${collectionName} (${documentArray.length} documents)`);
        
        const collection = db.collection(collectionName);
        
        // Clear existing data for this user in the collection
        if (userSpecificCollections.includes(collectionName)) {
          await collection.deleteMany({ userId: this.userId });
        } else if (collectionName === 'users') {
          await collection.deleteMany({ _id: this.userId } as any);
        }

        // Insert restored documents
        if (documentArray.length > 0) {
          await collection.insertMany(documentArray);
          restoredDocuments += documentArray.length;
        }
        
        console.log(`✅ Restored ${documentArray.length} documents to ${collectionName}`);
      }

      console.log(`✅ Database restore completed: ${restoredDocuments} documents restored`);

      // Log the restore operation
      const restoreLogCollection = db.collection('databaseRestores');
      await restoreLogCollection.insertOne({
        userId: this.userId,
        backupId,
        restoredAt: new Date().toISOString(),
        restoredDocuments,
        status: 'completed'
      });

      return { 
        success: true, 
        restored: restoredDocuments 
      };

    } catch (error) {
      console.error('Error restoring database:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export class GlobalBackupManager {
  private static instance: GlobalBackupManager;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isInitializing = false;
  public readonly BACKUP_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
  private lastBackupCheck: number = 0;

  private constructor() {}

  static getInstance(): GlobalBackupManager {
    if (!GlobalBackupManager.instance) {
      GlobalBackupManager.instance = new GlobalBackupManager();
    }
    return GlobalBackupManager.instance;
  }

  async startGlobalBackupScheduler(): Promise<void> {
    if (this.isRunning) {
      console.log('Backup scheduler is already running');
      return;
    }

    if (this.isInitializing) {
      console.log('Backup scheduler is already being initialized');
      return;
    }

    this.isInitializing = true;
    console.log('🚀 Starting global backup scheduler (checks every 30 seconds, backs up every 30 minutes)');
    
    try {
      // Force check for immediate backup need
      const needsBackup = await this.isBackupNeeded();
      
      if (needsBackup) {
        console.log('⚡ Running immediate backup on startup (time has elapsed)...');
        await this.performGlobalBackup();
      } else {
        const minutesLeft = await this.getTimeUntilNextBackup();
        console.log(`⏱️ Next backup due in ${minutesLeft} minutes`);
      }
      
      // Schedule backups to check every 30 seconds (very frequent checks for reliability)
      // Clear any existing interval first to prevent duplicates 
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      
      this.intervalId = setInterval(async () => {
        try {
          const now = Date.now();
          
          // Always check for backup need without any throttling
          const needsBackupNow = await this.isBackupNeeded();
          
          if (needsBackupNow) {
            console.log('⚡ AUTO: Time elapsed - starting automatic backup...');
            
            // Log current time for debugging
            console.log('⏰ Current time:', new Date().toLocaleString());
            
            try {
              await this.performGlobalBackup();
              console.log('✅ AUTO: Automatic backup completed successfully');
            } catch (backupError) {
              console.error('❌ AUTO: Backup failed:', backupError);
              
              // Try again in 5 minutes on failure
              setTimeout(async () => {
                console.log('🔄 Retrying failed backup...');
                try {
                  await this.performGlobalBackup();
                  console.log('✅ Retry backup completed successfully');
                } catch (retryError) {
                  console.error('❌ Retry backup also failed:', retryError);
                }
              }, 5 * 60 * 1000);
            }
          } else {
            const minutesLeft = await this.getTimeUntilNextBackup();
            // Only log occasionally to avoid spam
            if (Math.floor(now / (5 * 60 * 1000)) % 1 === 0) { // Log every 5 minutes
              console.log(`⏰ AUTO: Next backup in ${minutesLeft} minutes (${new Date().toLocaleString()})`);
            }
          }
        } catch (error) {
          console.error('❌ Error in automatic backup check:', error);
        }
      }, 30 * 1000); // Check every 30 seconds for maximum reliability
      
      this.isRunning = true;
      console.log('✅ Global backup scheduler started successfully');
      
    } catch (error) {
      console.error('Error starting backup scheduler:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  async stopGlobalBackupScheduler(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Global backup scheduler stopped');
  }

  // Method to get the actual last backup time from database
  async getLastBackupTimeFromDrive(): Promise<number | null> {
    try {
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Get the most recent backup across all users
      const latestBackup = await db.collection('databaseBackups')
        .find({})
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      
      if (latestBackup.length === 0) {
        console.log('🔍 No backups found in database');
        return null;
      }
      
      const backupTime = new Date(latestBackup[0].createdAt).getTime();
      console.log(`🔍 Found latest backup: ${new Date(backupTime).toLocaleString()}`);
      return backupTime;
      
    } catch (error) {
      console.error('Error getting last backup time from database:', error);
      return null;
    }
  }

  // Method to check if backup is needed (exact 30-minute rule)
  async isBackupNeeded(): Promise<boolean> {
    try {
      const lastBackupTime = await this.getLastBackupTimeFromDrive();
      
      if (!lastBackupTime) {
        console.log('⚡ No previous backup found - backup needed immediately');
        return true;
      }
      
      const now = Date.now();
      const timeSinceLastBackup = now - lastBackupTime;
      const thirtyMinutes = 30 * 60 * 1000; // Exactly 30 minutes
      
      // If it's been at least 30 minutes, backup is needed
      const isNeeded = timeSinceLastBackup >= thirtyMinutes;
      
      const minutesSinceLastBackup = Math.floor(timeSinceLastBackup / (60 * 1000));
      
      console.log(`🔍 Backup check: Last backup ${minutesSinceLastBackup} minutes ago (${new Date(lastBackupTime).toLocaleString()}), needed: ${isNeeded}`);
      
      if (isNeeded) {
        console.log('⚡ BACKUP NEEDED NOW - 30 minutes has elapsed since last backup');
        console.log(`   Last backup: ${new Date(lastBackupTime).toLocaleString()}`);
        console.log(`   Current time: ${new Date(now).toLocaleString()}`);
        console.log(`   Time elapsed: ${minutesSinceLastBackup} minutes`);
      }
      
      return isNeeded;
    } catch (error) {
      console.error('❌ Error checking if backup is needed:', error);
      // If there's an error checking, assume backup is needed for safety
      return true;
    }
  }

  // Method to get the time until next backup (in minutes)
  async getTimeUntilNextBackup(): Promise<number> {
    const lastBackupTime = await this.getLastBackupTimeFromDrive();
    
    if (!lastBackupTime) {
      // No backups exist, should backup now
      console.log('🔄 No previous backups found - backup is due immediately');
      return 0;
    }
    
    const now = Date.now();
    const nextBackupTime = lastBackupTime + this.BACKUP_INTERVAL; // Exactly 30 minutes after last backup
    const timeLeft = nextBackupTime - now;
    
    if (timeLeft <= 0) { // If time has passed, backup is due now
      console.log('⚡ Backup is overdue - scheduling immediately');
      return 0;
    }
    
    const minutesLeft = Math.ceil(timeLeft / (60 * 1000)); // Convert to minutes, always round up
    console.log(`⏱️ Next backup in ${minutesLeft} minutes`);
    return minutesLeft;
  }

  // Method to get backup status info
  async getBackupStatus() {
    const lastBackupTime = await this.getLastBackupTimeFromDrive();
    const now = Date.now();
    
    // Calculate next backup time properly
    let nextBackupTime: number | null = null;
    if (lastBackupTime) {
      nextBackupTime = lastBackupTime + this.BACKUP_INTERVAL;
      // If next backup time is in the past, it means backup is overdue
      if (nextBackupTime <= now) {
        nextBackupTime = now; // Backup should happen immediately
      }
    }
    
    const minutesUntilNext = await this.getTimeUntilNextBackup();
    
    // Make sure the formatted time is calculated from the proper nextBackupTime
    const nextBackupFormatted = nextBackupTime 
      ? new Date(nextBackupTime).toLocaleString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      : null;
    
    return {
      isRunning: this.isRunning,
      lastBackupTime: lastBackupTime,
      nextBackupTime: nextBackupTime,
      minutesUntilNext: minutesUntilNext,
      nextBackupFormatted: nextBackupFormatted
    };
  }

  async performGlobalBackup(): Promise<void> {
    try {
      console.log('🔄 Starting global backup process...');
      console.log('⏰ Backup started at:', new Date().toLocaleString());
      
      const client = await clientPromise;
      const db = client.db('wooconnect');
      
      // Get all users who have Google Drive configured
      const googleDriveConfigCollection = db.collection('googleDriveConfig');
      const usersWithDrive = await googleDriveConfigCollection.find({
        accessToken: { $exists: true, $ne: null }
      }).toArray();

      console.log(`👥 Found ${usersWithDrive.length} users with Google Drive configured`);

      if (usersWithDrive.length === 0) {
        console.log('⚠️ No users with Google Drive configured - skipping backup');
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const results: Array<{userId: string, success: boolean, error?: string}> = [];

      for (const userConfig of usersWithDrive) {
        try {
          const userId = userConfig.userId;
          console.log(`🔄 Creating backup for user: ${userId}`);
          
          // Check if token is expired and skip if so (but don't fail the entire process)
          const now = Date.now();
          const isExpired = userConfig.tokenExpiryDate && userConfig.tokenExpiryDate < (now - 60000);
          
          if (isExpired) {
            console.log(`⏭️ Skipping backup for user ${userId}: Token expired`);
            results.push({ userId, success: false, error: 'Token expired' });
            continue;
          }
          
          const backupService = new DatabaseBackupService(userId);
          const result = await backupService.createDatabaseBackup();
          
          if (result.success) {
            console.log(`✅ Backup completed for user ${userId}: ${result.backupId}`);
            successCount++;
            results.push({ userId, success: true });
          } else {
            console.error(`❌ Backup failed for user ${userId}: ${result.error}`);
            failureCount++;
            results.push({ userId, success: false, error: result.error });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error backing up user ${userConfig.userId}:`, error);
          failureCount++;
          results.push({ userId: userConfig.userId, success: false, error: errorMessage });
        }
        
        // Add a small delay between users to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ Global backup process completed at ${new Date().toLocaleString()}`);
      console.log(`📊 Results: ${successCount} successful, ${failureCount} failed`);
      
      // Log detailed results
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✅ ${result.userId}: Success`);
        } else {
          console.log(`  ❌ ${result.userId}: Failed - ${result.error}`);
        }
      });
      
      // If all backups failed, throw an error
      if (successCount === 0 && failureCount > 0) {
        throw new Error(`All ${failureCount} backup attempts failed`);
      }
      
    } catch (error) {
      console.error('❌ Error in global backup process:', error);
      throw error; // Re-throw to allow calling code to handle it
    }
  }

  getStatus(): { running: boolean; intervalId: boolean; initializing: boolean } {
    return {
      running: this.isRunning,
      intervalId: this.intervalId !== null,
      initializing: this.isInitializing
    };
  }
}

// Create a single instance that will be shared across the application
export const globalBackupManager = GlobalBackupManager.getInstance();
