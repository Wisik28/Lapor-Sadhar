import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/admin/login', '/admin/forgot-password', '/forgot-password'];

const PROTECTED_ROUTES = [
  '/buat-laporan',
  '/riwayat-laporan',
  '/status-laporan',
  '/ubah-pengajuan',
  '/lihat-status',
  '/profile',
  '/admin',
];

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.some((route) => {
    if (route === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/');
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get('auth_token')?.value;
  const adminToken = request.cookies.get('admin_token')?.value;
  const userSession = request.cookies.get('user_session')?.value;
  const isAuthenticated = !!(authToken || adminToken) && !!userSession;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const user = userSession ? JSON.parse(userSession) : null;
      if (user?.role === 'Admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/buat-laporan', request.url));
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname.startsWith('/admin')) {
      try {
        const user = userSession ? JSON.parse(userSession) : null;
        if (user?.role !== 'Admin') {
          return NextResponse.redirect(new URL('/buat-laporan', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
