"use client";

import { ProtectedLayout } from '@/components/ProtectedLayout';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedLayout
      allowedRoles={['Admin']}
      publicRoutes={['/admin/login', '/admin/forgot-password']}
    >
      {children}
    </ProtectedLayout>
  );
}