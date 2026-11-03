/**
 * Hook untuk Buat Laporan feature
 * Mengelola state dan logic untuk membuat laporan baru
 */

import { useState, useCallback } from 'react';
import { laporanApi } from '@/lib/api/laporan';
import { type LaporanItem, type Attachment } from '@/lib/api/types';

export interface BuatLaporanState {
  kategori: string;
  tanggal: string;
  lokasi: string;
  deskripsi: string;
  attachments: Attachment[];
  loading: boolean;
  error: string;
  success: string;
}

export function useBuatLaporan(today: string) {
  // Initialize state with today's date - this won't change per render
  const [state, setState] = useState<BuatLaporanState>(() => ({
    kategori: '',
    tanggal: today,
    lokasi: '',
    deskripsi: '',
    attachments: [],
    loading: false,
    error: '',
    success: '',
  }));

  // reset doesn't need 'today' in dependency because we use setState
  // and today is already set in initial state
  const reset = useCallback(() => {
    setState({
      kategori: '',
      tanggal: today,
      lokasi: '',
      deskripsi: '',
      attachments: [],
      loading: false,
      error: '',
      success: '',
    });
  }, [today]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: '' }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: '' }));
  }, []);

  const updateField = useCallback((field: keyof Omit<BuatLaporanState, 'loading' | 'error' | 'success' | 'attachments'>, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addAttachment = useCallback((file: File) => {
    setState((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          id: Date.now().toString(),
          name: file.name,
          url: URL.createObjectURL(file),
        },
      ],
    }));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((item) => item.id !== id),
    }));
  }, []);

  const submit = useCallback(
    async (nim: string, onSuccess?: (data: LaporanItem) => void) => {
      setState((prev) => {
        // Validate inline to avoid stale state
        if (!prev.kategori || !prev.lokasi || !prev.deskripsi) {
          setState((s) => ({ ...s, error: 'Mohon lengkapi seluruh kolom formulir!' }));
          return prev;
        }

        if (prev.tanggal > today) {
          setState((s) => ({ ...s, error: 'Tanggal kejadian tidak boleh melebihi hari ini!' }));
          return prev;
        }

        if (!nim) {
          setState((s) => ({ ...s, error: 'Sesi login tidak ditemukan. Silakan login ulang.' }));
          return prev;
        }

        // Clear errors and start loading
        return { ...prev, loading: true, error: '', success: '' };
      });

      try {
        // Use state directly within the async function
        const res = await laporanApi.create({
          nim,
          kategori_laporan: state.kategori,
          deskripsi: state.deskripsi,
          tanggal_kejadian: state.tanggal,
          lokasi: state.lokasi,
          foto: state.attachments[0]?.url ?? undefined,
        });

        if (res.status === 'success') {
          setState({
            kategori: '',
            tanggal: today,
            lokasi: '',
            deskripsi: '',
            attachments: [],
            loading: false,
            error: '',
            success: 'Laporan berhasil dikirim ke pihak pengelola USD!',
          });
          if (onSuccess && res.data) {
            onSuccess(res.data as LaporanItem);
          }
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: res.message || 'Gagal mengirim laporan.',
          }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Terjadi kesalahan. Coba lagi.',
        }));
      }
    },
    [state, today]
  );

  return {
    state,
    reset,
    clearError,
    clearSuccess,
    updateField,
    addAttachment,
    removeAttachment,
    submit,
  };
}
