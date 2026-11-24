import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, token, isAdmin, expiryTime, expiresAt } = body;

    if (!user || !token) {
      return NextResponse.json(
        { error: 'Missing user or token' },
        { status: 400 }
      );
    }

    const defaultMaxAgeSeconds = isAdmin ? 8 * 60 * 60 : 12 * 60 * 60;
    const parsedExpiryMs =
      typeof expiryTime === 'number' && Number.isFinite(expiryTime)
        ? expiryTime
        : typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt))
          ? Date.parse(expiresAt)
          : null;
    const maxAge =
      parsedExpiryMs !== null
        ? Math.max(1, Math.floor((parsedExpiryMs - Date.now()) / 1000))
        : defaultMaxAgeSeconds;

    const response = NextResponse.json({ success: true });

    // Set cookies dengan secure flags dan maxAge selaras masa berlaku sesi backend
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    };

    const tokenName = isAdmin ? 'admin_token' : 'auth_token';
    const otherTokenName = isAdmin ? 'auth_token' : 'admin_token';
    response.cookies.set(tokenName, token, cookieOptions);
    response.cookies.delete(otherTokenName);

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
