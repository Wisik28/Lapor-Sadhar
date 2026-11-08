'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type ProtectedLayoutProps = {
  children: React.ReactNode;
  allowedRoles?: Array<string>;
  publicRoutes?: string[];
};

export function ProtectedLayout({
  children,
  allowedRoles,
  publicRoutes = [],
}: ProtectedLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();
  const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    ['/login', '/register', '/forgot-password', '/admin/login', '/admin/forgot-password'].includes(pathname);

  useEffect(() => {
    if (isLoading || isPublicRoute) {
      return;
    }

    if (!isAuthenticated || !user) {
      router.replace(loginPath);
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(user.role === 'Admin' ? '/admin/dashboard' : '/buat-laporan');
    }
  }, [allowedRoles, isAuthenticated, isLoading, isPublicRoute, loginPath, pathname, router, user]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] text-sm text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C]" />
          <p className="font-medium">Memeriksa akses...</p>
        </div>
      </main>
    );
  }

  if (!isPublicRoute && (!isAuthenticated || !user)) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
