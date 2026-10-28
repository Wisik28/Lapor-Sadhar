import { NextRequest, NextResponse } from 'next/server';

// Halaman yang bisa diakses tanpa autentikasi (public routes)
const PUBLIC_ROUTES = ['/login', '/register', '/admin/login'];

// Halaman yang memerlukan autentikasi (private routes)
const PROTECTED_ROUTES = [
  '/buat-laporan',
  '/admin/dashboard',
  '/admin/account',
  '/admin/ubah-status',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cek kehadiran token autentikasi di cookie atau session storage
  // Note: Di Next.js middleware, kita perlu cek dari cookie karena sessionStorage tidak tersedia di server
  const authToken = request.cookies.get('auth_token')?.value;
  const adminToken = request.cookies.get('admin_token')?.value;
  const userSession = request.cookies.get('user_session')?.value;

  const isAuthenticated = !!(authToken || adminToken) && !!userSession;

  // Handle root path "/" - selalu redirect ke login jika belum auth, atau ke buat-laporan jika sudah auth
  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Jika sudah login, cek role dari user_session
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

  // Jika akses halaman public dan sudah login, redirect ke dashboard sesuai role
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (isAuthenticated) {
      try {
        const user = userSession ? JSON.parse(userSession) : null;
        if (user?.role === 'Admin') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/buat-laporan', request.url));
      } catch {
        // Jika error parsing, biarkan lanjut ke login page
      }
    }
    // Jika belum login, boleh akses halaman login/register
    return NextResponse.next();
  }

  // Jika akses halaman protected dan belum login
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Cek role untuk admin routes
    if (pathname.startsWith('/admin')) {
      try {
        const user = userSession ? JSON.parse(userSession) : null;
        if (user?.role !== 'Admin') {
          // User bukan admin, redirect ke halaman civitas akademika
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
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
