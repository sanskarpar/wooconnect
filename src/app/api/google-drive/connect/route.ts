import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as { user?: { id?: string } };
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    // Instead of generating a custom auth URL, redirect to NextAuth Google sign-in
    // This will use the existing Google provider configuration with Drive scopes
    const baseUrl = process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const signInUrl = `${baseUrl}/api/auth/signin/google`;
    
    return NextResponse.json({ authUrl: signInUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ message: 'Failed to generate authentication URL.' }, { status: 500 });
  }
}
