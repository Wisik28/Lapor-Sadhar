/**
 * Hook untuk Ubah Pengajuan feature
 * Mengelola state dan logic untuk mengubah laporan yang berstatus Terkirim
 */

import { useState, useCallback } from 'react';
import { laporanApi, LaporanItem } from '@/lib/api';

export interface UbahPengajuanState {
  selectedLaporan: LaporanItem | null;
  editKategori: string;
  editTanggal: string;
  editLokasi: string;
  editDeskripsi: string;
  saveLoading: boolean;
  deleteLoading: number | null;
  error: string;
  success: string;
}

export function useUbahPengajuan() {
  const [state, setState] = useState<UbahPengajuanState>({
    selectedLaporan: null,
    editKategori: '',
    editTanggal: '',
    editLokasi: '',
    editDeskripsi: '',
    saveLoading: false,
    deleteLoading: null,
    error: '',
    success: '',
  });

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setSuccess = useCallback((success: string) => {
    setState((prev) => ({ ...prev, success }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: '' }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: '' }));
  }, []);

  const selectForEdit = useCallback((laporan: LaporanItem, today: string) => {
    setState((prev) => ({
      ...prev,
      selectedLaporan: laporan,
      editKategori: laporan.kategori_laporan,
      editTanggal: laporan.tanggal_kejadian?.split('T')[0] ?? today,
      editLokasi: laporan.lokasi,
      editDeskripsi: laporan.deskripsi,
      error: '',
      success: '',
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedLaporan: null,
      editKategori: '',
      editTanggal: '',
      editLokasi: '',
      editDeskripsi: '',
    }));
  }, []);

  const updateEditField = useCallback((field: 'editKategori' | 'editTanggal' | 'editLokasi' | 'editDeskripsi', value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(
    async (nim: string, onSuccess?: () => void) => {
      if (!state.selectedLaporan) return;

      setError('');
      setSuccess('');

      if (!state.editKategori || !state.editLokasi || !state.editDeskripsi) {
        setError('Semua kolom wajib diisi!');
        return;
      }

      setState((prev) => ({ ...prev, saveLoading: true }));

      try {
        const res = await laporanApi.update(state.selectedLaporan.id_laporan, {
          kategori_laporan: state.editKategori,
          deskripsi: state.editDeskripsi,
          tanggal_kejadian: state.editTanggal,
          lokasi: state.editLokasi,
        });

        if (res.status === 'success') {
          setSuccess('Laporan berhasil diperbarui!');
          clearSelection();
          if (onSuccess) onSuccess();
        } else {
          setError(res.message || 'Gagal memperbarui laporan.');
        }
      } catch {
        setError('Terjadi kesalahan. Coba lagi.');
      } finally {
        setState((prev) => ({ ...prev, saveLoading: false }));
      }
    },
    [state.selectedLaporan, state.editKategori, state.editLokasi, state.editDeskripsi, state.editTanggal, setError, setSuccess, clearSelection]
  );

  const delete_ = useCallback(
    async (id: number, onSuccess?: () => void) => {
      if (!confirm('Yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.')) return;

      setState((prev) => ({ ...prev, deleteLoading: id }));

      try {
        const res = await laporanApi.delete(id);

        if (res.status === 'success') {
          setSuccess('Laporan berhasil dihapus.');
          if (state.selectedLaporan?.id_laporan === id) {
            clearSelection();
          }
          if (onSuccess) onSuccess();
        } else {
          setError(res.message || 'Gagal menghapus laporan.');
        }
      } catch {
        setError('Terjadi kesalahan. Coba lagi.');
      } finally {
        setState((prev) => ({ ...prev, deleteLoading: null }));
      }
    },
    [state.selectedLaporan, setError, setSuccess, clearSelection]
  );

  return {
    state,
    setError,
    setSuccess,
    clearError,
    clearSuccess,
    selectForEdit,
    clearSelection,
    updateEditField,
    save,
    delete: delete_,
  };
}
