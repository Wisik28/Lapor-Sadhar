/**
 * Hook untuk Buat Laporan feature
 * Mengelola state, auto-save draft (LocalStorage + fallback IndexedDB untuk foto besar),
 * Clear Form, dan pengiriman laporan dengan penanganan error jaringan/offline yang ramah pengguna.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { laporanApi } from '@/lib/api/laporan';
import { type LaporanItem, type Attachment } from '@/lib/api/types';
import {
  clearReportDraft,
  isDraftMeaningful,
  loadReportDraft,
  MAX_DRAFT_ATTACHMENTS,
  saveReportDraft,
  saveReportDraftSync,
  type SavedDraftAttachment,
} from '@/lib/reportDraftStorage';
import { formatUserFriendlyError, isNetworkError, isOffline } from '@/lib/networkError';

const KAMPUS_API_MAP: Record<string, string> = {
  'Kampus I': 'Kampus 1',
  'Kampus II': 'Kampus 2',
  'Kampus III': 'Kampus 3',
  'Kampus IV': 'Kampus 4',
};

const AUTO_SAVE_DEBOUNCE_MS = 350;

function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

function buildLokasi(lokasiKampus: string, detailLokasi: string): string {
  const kampus = lokasiKampus.trim();
  const detail = detailLokasi.trim();
  return kampus && detail ? `${kampus}, ${detail}` : kampus || detail;
}

function revokeBlobUrl(url: string): void {
  if (url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Abaikan error revoke URL
    }
  }
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

function extractSerializableAttachments(attachments: Attachment[]): SavedDraftAttachment[] {
  return attachments
    .filter((item) => typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:image/'))
    .slice(0, MAX_DRAFT_ATTACHMENTS)
    .map((item) => ({
      id: item.id,
      name: item.name,
      dataUrl: item.dataUrl as string,
    }));
}

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'restored';

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
  isRetryableError: boolean;
  success: string;
}

export function useBuatLaporan(
  today?: string,
  draftScope?: string | null,
  draftEnabled = true
) {
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
    isRetryableError: false,
    success: '',
  }));

  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  const isHydratedRef = useRef(false);
  const suppressNextSaveRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const activeScopeRef = useRef<string | null | undefined>(draftScope);

  const latestDraftSnapshotRef = useRef({
    kategori: '',
    lokasiKampus: '',
    detailLokasi: '',
    deskripsi: '',
    attachments: [] as SavedDraftAttachment[],
  });

  useEffect(() => {
    activeScopeRef.current = draftScope;
  }, [draftScope]);

  // Selaraskan snapshot terbaru untuk keperluan sinkronisasi beforeunload / pagehide
  useEffect(() => {
    latestDraftSnapshotRef.current = {
      kategori: state.kategori,
      lokasiKampus: state.lokasiKampus,
      detailLokasi: state.detailLokasi,
      deskripsi: state.deskripsi,
      attachments: extractSerializableAttachments(state.attachments),
    };
  }, [
    state.kategori,
    state.lokasiKampus,
    state.detailLokasi,
    state.deskripsi,
    state.attachments,
  ]);

  // Pulihkan draf tersimpan ketika komponen dibuka / setelah autentikasi siap
  useEffect(() => {
    if (!draftEnabled) return;

    let cancelled = false;
    isHydratedRef.current = false;

    const restoreDraft = async () => {
      const savedDraft = await loadReportDraft(draftScope);
      if (cancelled) return;

      if (savedDraft) {
        const restoredAttachments: Attachment[] = savedDraft.attachments.map((item) => ({
          id: item.id,
          name: item.name,
          url: item.dataUrl,
          dataUrl: item.dataUrl,
        }));

        suppressNextSaveRef.current = true;
        setState((prev) => {
          prev.attachments.forEach((a) => revokeBlobUrl(a.url));
          return {
            ...prev,
            kategori: savedDraft.kategori,
            lokasiKampus: savedDraft.lokasiKampus,
            detailLokasi: savedDraft.detailLokasi,
            lokasi: buildLokasi(savedDraft.lokasiKampus, savedDraft.detailLokasi),
            deskripsi: savedDraft.deskripsi,
            attachments: restoredAttachments,
            error: '',
            isRetryableError: false,
          };
        });
        setDraftSavedAt(savedDraft.savedAt);
        setDraftRestored(true);
        setHasSavedDraft(true);
        setDraftStatus('restored');
      } else {
        setDraftSavedAt(null);
        setDraftRestored(false);
        setHasSavedDraft(false);
        setDraftStatus('idle');
      }

      isHydratedRef.current = true;
    };

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [draftScope, draftEnabled]);

  // Auto-save ter-debounce setiap kali ada perubahan field atau lampiran foto
  useEffect(() => {
    if (!draftEnabled || !isHydratedRef.current || isSubmittingRef.current) {
      return;
    }

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const snapshot = {
      kategori: state.kategori,
      lokasiKampus: state.lokasiKampus,
      detailLokasi: state.detailLokasi,
      deskripsi: state.deskripsi,
      attachments: extractSerializableAttachments(state.attachments),
    };

    const hasContent =
      isDraftMeaningful(snapshot) || state.attachments.length > 0;

    if (!hasContent) {
      // Jika pengguna mengosongkan seluruh kolom secara manual, bersihkan draf agar tidak muncul kembali
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void clearReportDraft(activeScopeRef.current).then(() => {
          setHasSavedDraft(false);
          setDraftSavedAt(null);
          setDraftRestored(false);
          setDraftStatus('idle');
        });
      }, AUTO_SAVE_DEBOUNCE_MS);

      return () => {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (isSubmittingRef.current) return;

      setDraftStatus('saving');
      void saveReportDraft(activeScopeRef.current, snapshot).then((result) => {
        if (isSubmittingRef.current) return;
        if (result.saved) {
          setDraftSavedAt(result.savedAt);
          setHasSavedDraft(true);
          setDraftRestored(false);
          setDraftStatus('saved');
        }
      });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    draftEnabled,
    state.kategori,
    state.lokasiKampus,
    state.detailLokasi,
    state.deskripsi,
    state.attachments,
  ]);

  // Flush sinkron ke LocalStorage saat tab ditutup / refresh mendadak / pindah halaman
  useEffect(() => {
    if (!draftEnabled) return;

    const flushDraftBeforeLeave = () => {
      if (!isHydratedRef.current || isSubmittingRef.current) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const snapshot = latestDraftSnapshotRef.current;
      if (isDraftMeaningful(snapshot)) {
        saveReportDraftSync(activeScopeRef.current, snapshot);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDraftBeforeLeave();
      }
    };

    window.addEventListener('beforeunload', flushDraftBeforeLeave);
    window.addEventListener('pagehide', flushDraftBeforeLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushDraftBeforeLeave);
      window.removeEventListener('pagehide', flushDraftBeforeLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draftEnabled]);

  const clearForm = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    suppressNextSaveRef.current = true;
    latestDraftSnapshotRef.current = {
      kategori: '',
      lokasiKampus: '',
      detailLokasi: '',
      deskripsi: '',
      attachments: [],
    };

    setState((prev) => {
      prev.attachments.forEach((attachment) => revokeBlobUrl(attachment.url));
      return {
        kategori: '',
        tanggal: getCurrentDate(),
        lokasiKampus: '',
        detailLokasi: '',
        lokasi: '',
        deskripsi: '',
        attachments: [],
        loading: false,
        error: '',
        isRetryableError: false,
        success: '',
      };
    });

    await clearReportDraft(activeScopeRef.current);
    setHasSavedDraft(false);
    setDraftSavedAt(null);
    setDraftRestored(false);
    setDraftStatus('idle');
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: '', isRetryableError: false }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: '' }));
  }, []);

  const dismissDraftRestored = useCallback(() => {
    setDraftRestored(false);
  }, []);

  const updateField = useCallback(
    (
      field: keyof Omit<
        BuatLaporanState,
        'loading' | 'error' | 'isRetryableError' | 'success' | 'attachments'
      >,
      value: string
    ) => {
      setState((prev) => {
        const updated = { ...prev, [field]: value };
        updated.lokasi = buildLokasi(updated.lokasiKampus, updated.detailLokasi);
        return updated;
      });
    },
    []
  );

  const addAttachment = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blobUrl = URL.createObjectURL(file);

    setState((prev) => {
      if (prev.attachments.length >= MAX_DRAFT_ATTACHMENTS) {
        revokeBlobUrl(blobUrl);
        return prev;
      }

      return {
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            id,
            name: file.name,
            url: blobUrl,
            file,
          },
        ],
      };
    });

    // Konversi foto ke Data URL secara asinkron agar ikut tersimpan dalam draf auto-save
    void fileToDataUrl(file)
      .then((dataUrl) => {
        setState((prev) => ({
          ...prev,
          attachments: prev.attachments.map((item) =>
            item.id === id ? { ...item, dataUrl } : item
          ),
        }));
      })
      .catch(() => {
        // Biarkan lampiran tetap tersedia lewat File object selama sesi berlangsung
      });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.attachments.find((item) => item.id === id);
      if (target) {
        revokeBlobUrl(target.url);
      }
      return {
        ...prev,
        attachments: prev.attachments.filter((item) => item.id !== id),
      };
    });
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
          isRetryableError: false,
        }));
        return;
      }

      if (state.attachments.length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'Mohon unggah minimal 1 foto bukti kerusakan!',
          isRetryableError: false,
        }));
        return;
      }

      if (!nim) {
        setState((prev) => ({
          ...prev,
          error: 'Sesi login tidak ditemukan. Silakan login ulang.',
          isRetryableError: false,
        }));
        return;
      }

      if (isOffline()) {
        setState((prev) => ({
          ...prev,
          error:
            'Gagal mengirim laporan. Periksa koneksi internet Anda dan coba lagi. Data formulir Anda tetap tersimpan sebagai draf.',
          isRetryableError: true,
        }));
        return;
      }

      const tanggalSubmit = getCurrentDate();
      isSubmittingRef.current = true;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        tanggal: tanggalSubmit,
        loading: true,
        error: '',
        isRetryableError: false,
        success: '',
      }));

      try {
        const fotoData = await Promise.all(
          state.attachments.map((attachment) => {
            if (attachment.dataUrl && attachment.dataUrl.startsWith('data:image/')) {
              return Promise.resolve(attachment.dataUrl);
            }
            if (attachment.file) {
              return fileToDataUrl(attachment.file);
            }
            return Promise.reject(new Error('Foto gagal dibaca. Silakan pilih ulang foto.'));
          })
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
          state.attachments.forEach((attachment) => revokeBlobUrl(attachment.url));

          suppressNextSaveRef.current = true;
          latestDraftSnapshotRef.current = {
            kategori: '',
            lokasiKampus: '',
            detailLokasi: '',
            deskripsi: '',
            attachments: [],
          };

          await clearReportDraft(activeScopeRef.current);
          setHasSavedDraft(false);
          setDraftSavedAt(null);
          setDraftRestored(false);
          setDraftStatus('idle');

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
            isRetryableError: false,
            success: 'Laporan berhasil dikirim ke pihak pengelola USD!',
          });
          if (onSuccess && res.data) {
            onSuccess(res.data as LaporanItem);
          }
        } else {
          const networkFail = isNetworkError(res.message || '');
          const baseMessage = formatUserFriendlyError(
            res.message,
            'submit',
            'Gagal mengirim laporan. Silakan coba lagi.'
          );
          setState((prev) => ({
            ...prev,
            loading: false,
            error: networkFail
              ? `${baseMessage} Data formulir Anda tetap tersimpan sebagai draf.`
              : baseMessage,
            isRetryableError: networkFail || !res.errors,
          }));
        }
      } catch (error) {
        const networkFail = isNetworkError(error);
        const baseMessage = formatUserFriendlyError(
          error,
          'submit',
          'Gagal mengirim laporan. Silakan coba lagi.'
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: networkFail
            ? `${baseMessage} Data formulir Anda tetap tersimpan sebagai draf.`
            : baseMessage,
          isRetryableError: true,
        }));
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [state]
  );

  return {
    state,
    draftStatus,
    draftSavedAt,
    draftRestored,
    hasSavedDraft,
    clearForm,
    reset: clearForm,
    clearError,
    clearSuccess,
    dismissDraftRestored,
    updateField,
    addAttachment,
    removeAttachment,
    submit,
  };
}
