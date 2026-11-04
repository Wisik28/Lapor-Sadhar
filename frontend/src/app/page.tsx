'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser, isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentAuthUser();

    if (!user || !isAuthenticated()) {
      router.replace('/login');
      return;
    }

    router.replace(user.role === 'Admin' ? '/admin/dashboard' : '/buat-laporan');
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] text-slate-600">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7A0C0C]/20 border-t-[#7A0C0C]" />
        <p className="text-sm font-medium">Memeriksa sesi Anda...</p>
      </div>
    </main>
  );
}
