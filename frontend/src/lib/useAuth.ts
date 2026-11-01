import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser, isAuthenticated, AuthUser } from '@/lib/auth';

/**
 * Hook untuk proteksi halaman yang memerlukan autentikasi
 * Redirect ke /login jika belum authenticated
 */
export function useAuthProtection() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const currentUser = getCurrentAuthUser();
      
      if (!currentUser || !isAuthenticated()) {
        setIsLoading(false);
        router.replace('/login');
        return;
      }

      setUser(currentUser);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  return { isLoading, user };
}

/**
 * Hook untuk proteksi halaman admin
 * Redirect ke /buat-laporan jika bukan admin
 */
export function useAdminProtection() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const currentUser = getCurrentAuthUser();
      
      if (!currentUser) {
        setIsLoading(false);
        router.replace('/login');
        return;
      }

      if (currentUser.role !== 'Admin') {
        setIsLoading(false);
        router.replace('/buat-laporan');
        return;
      }

      setUser(currentUser);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  return { isLoading, user };
}

/**
 * Hook untuk mendapatkan current user
 */
export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentAuthUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  return { user, isLoading };
}
