import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { isAdmin } = body;

    const response = NextResponse.json({ success: true });

    // Clear cookies
    const tokenName = isAdmin ? 'admin_token' : 'auth_token';
    response.cookies.delete(tokenName);
    response.cookies.delete('user_session');

    return response;
  } catch (error) {
    console.error('Clear session error:', error);
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}
