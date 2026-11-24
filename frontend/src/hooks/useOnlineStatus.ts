'use client';

import { useState, useEffect, useRef } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  justReconnected: boolean;
}

/**
 * Memantau status koneksi internet browser (online / offline) secara aman terhadap SSR/hidrasi.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
    });

    const handleOffline = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setIsOnline(false);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        setJustReconnected(false);
        reconnectTimerRef.current = null;
      }, 4000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return { isOnline, justReconnected };
}
