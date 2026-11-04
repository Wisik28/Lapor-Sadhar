import type { ReactNode } from 'react';
import { ProtectedLayout } from '@/components/ProtectedLayout';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout allowedRoles={['Mahasiswa', 'Karyawan']}>
      {children}
    </ProtectedLayout>
  );
}
