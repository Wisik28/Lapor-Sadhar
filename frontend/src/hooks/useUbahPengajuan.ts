/**
 * Hook untuk Ubah Pengajuan feature
 * Mengelola state dan logic untuk mengubah laporan yang berstatus Terkirim
 */

import { useState, useCallback } from 'react';
import { laporanApi, LaporanItem } from '@/lib/api';
import { getFotoList, getFotoUrl } from '@/lib/laporanPhoto';
import { formatUserFriendlyError } from '@/lib/networkError';

export const MAX_EDIT_PHOTOS = 5;

export interface EditablePhoto {
  id: string;
  name: string;
  previewUrl: string;
  existingValue?: string;
  file?: File;
}

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

function revokeNewPhotoUrls(photos: EditablePhoto[]) {
  photos.forEach((photo) => {
    if (photo.file && photo.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  });
}

export interface UbahPengajuanState {
  selectedLaporan: LaporanItem | null;
  editKategori: string;
  editTanggal: string;
  editLokasiKampus: string;
  editLokasi: string;
  editDeskripsi: string;
  editPhotos: EditablePhoto[];
  photoChanged: boolean;
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
    editLokasiKampus: '',
    editLokasi: '',
    editDeskripsi: '',
    editPhotos: [],
    photoChanged: false,
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
    const existingPhotos: EditablePhoto[] = getFotoList(laporan.foto)
      .filter((raw) => !raw.trim().startsWith('blob:'))
      .slice(0, MAX_EDIT_PHOTOS)
      .map((raw, idx) => {
        const normalized = raw.trim().startsWith('/storage/')
          ? raw.trim().replace(/^\/+/, '')
          : raw.trim();
        return {
          id: `existing-${laporan.id_laporan}-${idx}`,
          name: `Foto ${idx + 1}`,
          previewUrl: getFotoUrl(normalized),
          existingValue: normalized,
        };
      });

    setState((prev) => {
      revokeNewPhotoUrls(prev.editPhotos);
      return {
        ...prev,
        selectedLaporan: laporan,
        editKategori: laporan.kategori_laporan,
        editTanggal: laporan.tanggal_kejadian?.split('T')[0] ?? today,
        editLokasiKampus: laporan.lokasi_kampus ?? '',
        editLokasi: laporan.lokasi,
        editDeskripsi: laporan.deskripsi,
        editPhotos: existingPhotos,
        photoChanged: false,
        error: '',
        success: '',
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => {
      revokeNewPhotoUrls(prev.editPhotos);
      return {
        ...prev,
        selectedLaporan: null,
        editKategori: '',
        editTanggal: '',
        editLokasiKampus: '',
        editLokasi: '',
        editDeskripsi: '',
        editPhotos: [],
        photoChanged: false,
      };
    });
  }, []);

  const updateEditField = useCallback(
    (
      field: 'editKategori' | 'editTanggal' | 'editLokasiKampus' | 'editLokasi' | 'editDeskripsi',
      value: string
    ) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addEditPhotos = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setState((prev) => {
      const remainingSlots = Math.max(0, MAX_EDIT_PHOTOS - prev.editPhotos.length);
      if (remainingSlots === 0) return prev;

      const added: EditablePhoto[] = fileArray.slice(0, remainingSlots).map((file, idx) => ({
        id: `new-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        file,
      }));

      return {
        ...prev,
        editPhotos: [...prev.editPhotos, ...added],
        photoChanged: true,
        error: '',
      };
    });
  }, []);

  const removeEditPhoto = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.editPhotos.find((item) => item.id === id);
      if (target) {
        revokeNewPhotoUrls([target]);
      }
      return {
        ...prev,
        editPhotos: prev.editPhotos.filter((item) => item.id !== id),
        photoChanged: true,
      };
    });
  }, []);

  const save = useCallback(
    async (
      nim: string,
      onSuccess?: (updated?: LaporanItem) => void,
      options?: { keepSelection?: boolean }
    ) => {
      if (!state.selectedLaporan) return;

      setError('');
      setSuccess('');

      if (!state.editKategori || !state.editLokasiKampus || !state.editLokasi || !state.editDeskripsi) {
        setError('Semua kolom wajib diisi!');
        return;
      }

      if (state.photoChanged && state.editPhotos.length === 0) {
        setError('Mohon unggah minimal 1 foto bukti laporan!');
        return;
      }

      setState((prev) => ({ ...prev, saveLoading: true }));

      try {
        let fotoPayload: string | undefined;
        if (state.photoChanged) {
          const resolvedPhotos = await Promise.all(
            state.editPhotos.map((photo) =>
              photo.file ? fileToDataUrl(photo.file) : Promise.resolve(photo.existingValue ?? '')
            )
          );
          const validPhotos = resolvedPhotos.filter((item) => item.trim().length > 0);
          if (validPhotos.length === 0) {
            setError('Mohon unggah minimal 1 foto bukti laporan!');
            return;
          }
          fotoPayload =
            validPhotos.length > 1 ? JSON.stringify(validPhotos) : validPhotos[0];
        }

        const res = await laporanApi.update(state.selectedLaporan.id_laporan, {
          kategori_laporan: state.editKategori,
          deskripsi: state.editDeskripsi,
          tanggal_kejadian: state.editTanggal,
          lokasi_kampus: state.editLokasiKampus,
          lokasi: state.editLokasi,
          ...(fotoPayload !== undefined ? { foto: fotoPayload } : {}),
        });

        if (res.status === 'success') {
          const updatedItem =
            res.data && !Array.isArray(res.data) ? res.data : undefined;

          if (options?.keepSelection) {
            setState((prev) => ({
              ...prev,
              selectedLaporan: updatedItem
                ? {
                    ...prev.selectedLaporan!,
                    ...updatedItem,
                    status_terkini: prev.selectedLaporan?.status_terkini ?? 'Terkirim',
                  }
                : prev.selectedLaporan,
              photoChanged: false,
              success: 'Perubahan laporan berhasil disimpan!',
            }));
          } else {
            setSuccess('Laporan berhasil diperbarui!');
            clearSelection();
          }

          if (onSuccess) onSuccess(updatedItem);
        } else {
          setError(
            formatUserFriendlyError(
              res.message,
              'submit',
              'Gagal memperbarui laporan. Silakan coba lagi.'
            )
          );
        }
      } catch (err) {
        setError(
          formatUserFriendlyError(
            err,
            'submit',
            'Gagal memperbarui laporan. Silakan coba lagi.'
          )
        );
      } finally {
        setState((prev) => ({ ...prev, saveLoading: false }));
      }
    },
    [
      state.selectedLaporan,
      state.editKategori,
      state.editLokasiKampus,
      state.editLokasi,
      state.editDeskripsi,
      state.editTanggal,
      state.editPhotos,
      state.photoChanged,
      setError,
      setSuccess,
      clearSelection,
    ]
  );

  const delete_ = useCallback(
    async (
      id: number,
      onSuccess?: () => void,
      options?: { skipConfirm?: boolean }
    ) => {
      if (
        !options?.skipConfirm &&
        !confirm('Yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.')
      ) {
        return;
      }

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
          setError(
            formatUserFriendlyError(
              res.message,
              'action',
              'Gagal menghapus laporan. Silakan coba lagi.'
            )
          );
        }
      } catch (err) {
        setError(
          formatUserFriendlyError(
            err,
            'action',
            'Gagal menghapus laporan. Silakan coba lagi.'
          )
        );
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
    addEditPhotos,
    removeEditPhoto,
    save,
    delete: delete_,
  };
}
