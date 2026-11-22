/**
- Hook untuk Buat Laporan feature
- Mengelola state dan logic untuk membuat laporan baru
 */

import { useState, useCallback } from 'react';
import { laporanApi } from '@/lib/api/laporan';
import { type LaporanItem, type Attachment } from '@/lib/api/types';

const KAMPUS_API_MAP: Record<string, string> = {
  'Kampus I': 'Kampus 1',
  'Kampus II': 'Kampus 2',
  'Kampus III': 'Kampus 3',
  'Kampus IV': 'Kampus 4',
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Foto gagal dibaca. Silakan pilih ulang foto.'));
      }
    };
    reader.onerror = () => reject(new Error('Foto gagal dibaca. Silakan pilih ulang foto.'));
    reader.readAsDataURL(file);
  });
}

export interface BuatLaporanState {
  kategori: string;
  tanggal: string;
  lokasiKampus: string;
  detailLokasi: string;
  lokasi: string;
  deskripsi: string;
  attachments: Attachment[];
  loading: boolean;
  error: string;
  success: string;
}

export function useBuatLaporan(today?: string) {
  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  const initialDate = today || getCurrentDate();

  const [state, setState] = useState<BuatLaporanState>(() => ({
    kategori: '',
    tanggal: initialDate,
    lokasiKampus: '',
    detailLokasi: '',
    lokasi: '',
    deskripsi: '',
    attachments: [],
    loading: false,
    error: '',
    success: '',
  }));

  const reset = useCallback(() => {
    setState({
      kategori: '',
      tanggal: getCurrentDate(),
      lokasiKampus: '',
      detailLokasi: '',
      lokasi: '',
      deskripsi: '',
      attachments: [],
      loading: false,
      error: '',
      success: '',
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: '' }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: '' }));
  }, []);

  const updateField = useCallback(
    (
      field: keyof Omit<BuatLaporanState, 'loading' | 'error' | 'success' | 'attachments'>,
      value: string
    ) => {
      setState((prev) => {
        const updated = { ...prev, [field]: value };
        const kampus = updated.lokasiKampus.trim();
        const detail = updated.detailLokasi.trim();
        updated.lokasi = kampus && detail ? `${kampus}, ${detail}` : kampus || detail;
        return updated;
      });
    },
    []
  );

  const addAttachment = useCallback((file: File) => {
    setState((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          id: Date.now().toString(),
          name: file.name,
          url: URL.createObjectURL(file),
          file,
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
      if (
        !state.kategori ||
        !state.lokasiKampus.trim() ||
        !state.detailLokasi.trim() ||
        !state.deskripsi.trim()
      ) {
        setState((prev) => ({
          ...prev,
          error: 'Mohon lengkapi seluruh kolom formulir termasuk kampus dan detail lokasi!',
        }));
        return;
      }

      if (state.attachments.length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'Mohon unggah minimal 1 foto bukti kerusakan!',
        }));
        return;
      }

      if (!nim) {
        setState((prev) => ({
          ...prev,
          error: 'Sesi login tidak ditemukan. Silakan login ulang.',
        }));
        return;
      }

      const tanggalSubmit = getCurrentDate();

      setState((prev) => ({ ...prev, tanggal: tanggalSubmit, loading: true, error: '', success: '' }));

      try {
        const fotoData = await Promise.all(
          state.attachments.map((attachment) => fileToDataUrl(attachment.file))
        );
        const fotoPayload =
          fotoData.length > 1
            ? JSON.stringify(fotoData)
            : (fotoData[0] ?? undefined);

        const kampusTerpilih = state.lokasiKampus.trim();
        const lokasiKampusApi = KAMPUS_API_MAP[kampusTerpilih] ?? kampusTerpilih;
        const lokasiGabungan = `${kampusTerpilih}, ${state.detailLokasi.trim()}`;

        const res = await laporanApi.create({
          nim,
          kategori_laporan: state.kategori,
          deskripsi: state.deskripsi.trim(),
          tanggal_kejadian: tanggalSubmit,
          lokasi_kampus: lokasiKampusApi,
          lokasi: lokasiGabungan,
          foto: fotoPayload,
        });

        if (res.status === 'success') {
          state.attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
          setState({
            kategori: '',
            tanggal: tanggalSubmit,
            lokasiKampus: '',
            detailLokasi: '',
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
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.',
        }));
      }
    },
    [state]
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