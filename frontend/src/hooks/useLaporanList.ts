/**
 * Hook untuk Lihat Status & Riwayat Laporan features
 * Mengelola state dan logic untuk menampilkan list laporan dengan filter
 */

import { useState, useCallback, useEffect } from 'react';
import { laporanApi, LaporanItem } from '@/lib/api';

export interface LaporanListState {
  allLaporan: LaporanItem[];
  loading: boolean;
  error: string;
  expandedId: number | null;
}

export function useLaporanList() {
  const [state, setState] = useState<LaporanListState>({
    allLaporan: [],
    loading: false,
    error: '',
    expandedId: null,
  });

  const fetch = useCallback(async (nim: string) => {
    if (!nim) return;

    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const res = await laporanApi.getAll(nim);

      if (res.status === 'success' && Array.isArray(res.data)) {
        setState((prev) => ({
          ...prev,
          allLaporan: res.data as LaporanItem[],
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: res.message || 'Gagal mengambil data laporan.',
          loading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        loading: false,
      }));
    }
  }, []);

  const setExpandedId = useCallback((id: number | null) => {
    setState((prev) => ({ ...prev, expandedId: id }));
  }, []);

  const getEditableLaporan = useCallback(() => {
    return state.allLaporan.filter((l) => l.status_terkini === 'Terkirim');
  }, [state.allLaporan]);

  const getHistoryLaporan = useCallback(() => {
    return state.allLaporan.filter((l) => l.status_terkini === 'Selesai' || l.status_terkini === 'Ditolak');
  }, [state.allLaporan]);

  const getActiveLaporan = useCallback(() => {
    return state.allLaporan.filter((l) => ['Terkirim', 'Diverifikasi', 'Diproses'].includes(l.status_terkini));
  }, [state.allLaporan]);

  return {
    state,
    fetch,
    setExpandedId,
    getEditableLaporan,
    getHistoryLaporan,
    getActiveLaporan,
  };
}
