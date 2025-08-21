import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { SimpleBackupService } from '@/lib/simpleBackupService';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const backupService = new SimpleBackupService(userId);
    
    console.log(`🔄 Manual backup triggered for user: ${userId}`);
    
    const result = await backupService.createBackup();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        backupId: result.backupId,
        totalDocuments: result.totalDocuments
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Failed to create backup'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in backup API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
