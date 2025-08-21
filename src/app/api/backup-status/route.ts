import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No session found' 
      });
    }

    return NextResponse.json({
      authenticated: true,
      userId: session.user.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in backup status API:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
