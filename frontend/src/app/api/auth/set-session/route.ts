import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, token, isAdmin } = body;

    if (!user || !token) {
      return NextResponse.json(
        { error: 'Missing user or token' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ success: true });

    // Set cookies dengan secure flags
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    };

    const tokenName = isAdmin ? 'admin_token' : 'auth_token';
    response.cookies.set(tokenName, token, cookieOptions);

    // Juga set user_session cookie (bisa dibaca middleware)
    response.cookies.set('user_session', JSON.stringify(user), {
      ...cookieOptions,
      httpOnly: false, // Biar bisa dibaca dari client jika perlu
    });

    return response;
  } catch (error) {
    console.error('Set session error:', error);
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}
