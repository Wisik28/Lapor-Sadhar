/**
 * Hook untuk Lihat Status & Riwayat Laporan features
 * Mengelola state dan logic untuk menampilkan list laporan dengan filter
 */

import { useState, useCallback } from 'react';
import { laporanApi, LaporanItem } from '@/lib/api';
import { normalizeLaporanStatus } from '@/lib/laporanStatus';
import { formatUserFriendlyError } from '@/lib/networkError';

export interface LaporanListState {
  allLaporan: LaporanItem[];
  loading: boolean;
  error: string;
  expandedId: number | null;
}

function getFetchErrorMessage(err: unknown): string {
  return formatUserFriendlyError(
    err,
    'load',
    'Gagal memuat data laporan. Silakan coba lagi.'
  );
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
          error: '',
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: formatUserFriendlyError(
            res.message,
            'load',
            'Gagal memuat data laporan. Silakan coba lagi.'
          ),
          loading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: getFetchErrorMessage(err),
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
    return state.allLaporan.filter((l) => {
      const status = normalizeLaporanStatus(l.status_terkini);
      return status === 'Selesai' || status === 'Ditolak';
    });
  }, [state.allLaporan]);

  const getActiveLaporan = useCallback(() => {
    return state.allLaporan.filter((l) =>
      ['Terkirim', 'Sedang Diverifikasi', 'Terverifikasi', 'Diproses'].includes(
        normalizeLaporanStatus(l.status_terkini)
      )
    );
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
