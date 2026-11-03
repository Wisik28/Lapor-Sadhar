import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser, isAuthenticated, isAdmin, AuthUser, isSessionExpired, getSessionRemainingTime } from '@/lib/auth';

/**
 * Hook untuk proteksi halaman yang memerlukan autentikasi
 * Redirect ke /login jika belum authenticated atau session expired
 */
export function useAuthProtection() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string>('');

  useEffect(() => {
    const checkAuth = () => {
      // Check session expiry
      if (isSessionExpired()) {
        setSessionMessage('Session Anda telah berakhir. Silakan login kembali.');
        router.push('/login?session=expired');
        return;
      }

      const currentUser = getCurrentAuthUser();
      
      if (!currentUser || !isAuthenticated()) {
        router.push('/login');
        return;
      }

      setUser(currentUser);
      setIsLoading(false);
    };

    checkAuth();

    // Set up session check interval (setiap 30 detik)
    const interval = setInterval(() => {
      if (isSessionExpired()) {
        setSessionMessage('Session Anda telah berakhir. Silakan login kembali.');
        router.push('/login?session=expired');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  return { isLoading, user, sessionMessage };
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
      // Check session expiry
      if (isSessionExpired()) {
        router.push('/login?session=expired');
        return;
      }

      const currentUser = getCurrentAuthUser();
      
      if (!currentUser) {
        router.push('/login');
        return;
      }

      if (currentUser.role !== 'Admin') {
        router.push('/buat-laporan');
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
    // Check session expiry
    if (isSessionExpired()) {
      setUser(null);
    } else {
      const currentUser = getCurrentAuthUser();
      setUser(currentUser);
    }
    setIsLoading(false);
  }, []);

  return { user, isLoading };
}
