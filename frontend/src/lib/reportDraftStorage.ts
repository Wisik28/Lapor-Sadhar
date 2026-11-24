/**
 * Penyimpanan auto-save draf formulir Buat Laporan.
 * - Menyimpan isian teks pada LocalStorage (aman & instan, sinkron saat beforeunload/refresh).
 * - Menyimpan lampiran foto secara inline di LocalStorage jika muat, dan otomatis
 *   fallback ke IndexedDB saat ukuran foto melebihi kuota LocalStorage.
 * - Melakukan sanitasi ketat agar data draf korup / tidak valid tidak merusak aplikasi.
 */

export const REPORT_DRAFT_VERSION = 1;
export const REPORT_DRAFT_KEY_PREFIX = 'lapor_sadhar_buat_laporan_draft_v1';
export const MAX_DRAFT_ATTACHMENTS = 5;

const ALLOWED_KATEGORI = new Set(['', 'Fasilitas', 'Kebersihan']);
const ALLOWED_KAMPUS = new Set(['', 'Kampus I', 'Kampus II', 'Kampus III', 'Kampus IV']);

const IDB_NAME = 'lapor_sadhar_drafts_db';
const IDB_STORE = 'draft_photos';
const IDB_VERSION = 1;

export interface SavedDraftAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface ReportDraftData {
  version: number;
  kategori: string;
  lokasiKampus: string;
  detailLokasi: string;
  deskripsi: string;
  attachments: SavedDraftAttachment[];
  savedAt: string;
  photosInIndexedDb?: boolean;
}

export interface SaveDraftResult {
  saved: boolean;
  photosSaved: boolean;
  savedAt: string;
}

export function buildDraftStorageKey(userScope?: string | null): string {
  const normalized = (userScope ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return normalized
    ? `${REPORT_DRAFT_KEY_PREFIX}:${normalized}`
    : `${REPORT_DRAFT_KEY_PREFIX}:default`;
}

export function isDraftMeaningful(draft: {
  kategori?: string;
  lokasiKampus?: string;
  detailLokasi?: string;
  deskripsi?: string;
  attachments?: Array<unknown>;
}): boolean {
  return Boolean(
    (draft.kategori && draft.kategori.trim().length > 0) ||
      (draft.lokasiKampus && draft.lokasiKampus.trim().length > 0) ||
      (draft.detailLokasi && draft.detailLokasi.trim().length > 0) ||
      (draft.deskripsi && draft.deskripsi.trim().length > 0) ||
      (Array.isArray(draft.attachments) && draft.attachments.length > 0)
  );
}

function sanitizeAttachments(raw: unknown): SavedDraftAttachment[] {
  if (!Array.isArray(raw)) return [];

  const sanitized: SavedDraftAttachment[] = [];
  for (const item of raw) {
    if (sanitized.length >= MAX_DRAFT_ATTACHMENTS) break;
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim()
      : `draft-img-${sanitized.length + 1}`;
    const name = typeof candidate.name === 'string' && candidate.name.trim()
      ? candidate.name.trim().slice(0, 180)
      : `Foto ${sanitized.length + 1}`;
    const dataUrl = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : '';

    if (!dataUrl.startsWith('data:image/')) {
      continue;
    }

    sanitized.push({ id, name, dataUrl });
  }

  return sanitized;
}

/**
 * Validasi dan sanitasi payload JSON mentah dari storage.
 * Mengembalikan null apabila JSON korup, versi tidak cocok, atau tidak berisi data bermakna.
 */
export function parseDraftPayload(rawText: string | null): ReportDraftData | null {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.version !== undefined && obj.version !== REPORT_DRAFT_VERSION) {
      return null;
    }

    const rawKategori = typeof obj.kategori === 'string' ? obj.kategori.trim() : '';
    const rawKampus = typeof obj.lokasiKampus === 'string' ? obj.lokasiKampus.trim() : '';
    const detailLokasi = typeof obj.detailLokasi === 'string' ? obj.detailLokasi : '';
    const deskripsi = typeof obj.deskripsi === 'string' ? obj.deskripsi : '';
    const attachments = sanitizeAttachments(obj.attachments);
    const photosInIndexedDb = obj.photosInIndexedDb === true;

    const kategori = ALLOWED_KATEGORI.has(rawKategori) ? rawKategori : '';
    const lokasiKampus = ALLOWED_KAMPUS.has(rawKampus) ? rawKampus : '';

    const savedAt =
      typeof obj.savedAt === 'string' && !Number.isNaN(new Date(obj.savedAt).getTime())
        ? obj.savedAt
        : new Date().toISOString();

    const sanitized: ReportDraftData = {
      version: REPORT_DRAFT_VERSION,
      kategori,
      lokasiKampus,
      detailLokasi,
      deskripsi,
      attachments,
      savedAt,
      photosInIndexedDb,
    };

    if (!isDraftMeaningful(sanitized) && !photosInIndexedDb) {
      return null;
    }

    return sanitized;
  } catch {
    return null;
  }
}

// ─── IndexedDB Helpers (fallback saat ukuran foto melebihi kuota LocalStorage) ───

function openDraftPhotosDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function savePhotosToIndexedDb(
  key: string,
  attachments: SavedDraftAttachment[]
): Promise<boolean> {
  const db = await openDraftPhotosDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      if (attachments.length === 0) {
        store.delete(key);
      } else {
        store.put(attachments, key);
      }
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

async function loadPhotosFromIndexedDb(key: string): Promise<SavedDraftAttachment[]> {
  const db = await openDraftPhotosDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve(sanitizeAttachments(req.result));
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

async function deletePhotosFromIndexedDb(key: string): Promise<void> {
  const db = await openDraftPhotosDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

// ─── Public Draft Storage API ───────────────────────────────────────────────────

/**
 * Menyimpan teks draf secara sinkron ke LocalStorage (digunakan saat beforeunload / pagehide).
 */
export function saveReportDraftSync(
  userScope: string | null | undefined,
  draft: Omit<ReportDraftData, 'version' | 'savedAt' | 'photosInIndexedDb'>
): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  const key = buildDraftStorageKey(userScope);
  const sanitizedAttachments = sanitizeAttachments(draft.attachments);

  if (!isDraftMeaningful({ ...draft, attachments: sanitizedAttachments })) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Abaikan error storage
    }
    return false;
  }

  const savedAt = new Date().toISOString();
  const payloadWithPhotos: ReportDraftData = {
    version: REPORT_DRAFT_VERSION,
    kategori: ALLOWED_KATEGORI.has(draft.kategori) ? draft.kategori : '',
    lokasiKampus: ALLOWED_KAMPUS.has(draft.lokasiKampus) ? draft.lokasiKampus : '',
    detailLokasi: draft.detailLokasi,
    deskripsi: draft.deskripsi,
    attachments: sanitizedAttachments,
    savedAt,
    photosInIndexedDb: false,
  };

  try {
    localStorage.setItem(key, JSON.stringify(payloadWithPhotos));
    return true;
  } catch {
    // Jika melebihi kuota karena foto besar, tetap simpan teks draf secara aman
    try {
      const existingRaw = localStorage.getItem(key);
      const existing = parseDraftPayload(existingRaw);
      const textOnlyPayload: ReportDraftData = {
        ...payloadWithPhotos,
        attachments: [],
        photosInIndexedDb: existing?.photosInIndexedDb ?? sanitizedAttachments.length > 0,
      };
      localStorage.setItem(key, JSON.stringify(textOnlyPayload));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Menyimpan seluruh draf (teks + lampiran foto) dengan fallback otomatis ke IndexedDB
 * apabila ukuran lampiran foto melebihi batas kuota LocalStorage.
 */
export async function saveReportDraft(
  userScope: string | null | undefined,
  draft: Omit<ReportDraftData, 'version' | 'savedAt' | 'photosInIndexedDb'>
): Promise<SaveDraftResult> {
  const savedAt = new Date().toISOString();
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { saved: false, photosSaved: false, savedAt };
  }

  const key = buildDraftStorageKey(userScope);
  const sanitizedAttachments = sanitizeAttachments(draft.attachments);

  if (!isDraftMeaningful({ ...draft, attachments: sanitizedAttachments })) {
    await clearReportDraft(userScope);
    return { saved: false, photosSaved: true, savedAt };
  }

  const basePayload: ReportDraftData = {
    version: REPORT_DRAFT_VERSION,
    kategori: ALLOWED_KATEGORI.has(draft.kategori) ? draft.kategori : '',
    lokasiKampus: ALLOWED_KAMPUS.has(draft.lokasiKampus) ? draft.lokasiKampus : '',
    detailLokasi: draft.detailLokasi,
    deskripsi: draft.deskripsi,
    attachments: sanitizedAttachments,
    savedAt,
    photosInIndexedDb: false,
  };

  // 1. Coba simpan langsung di LocalStorage
  try {
    localStorage.setItem(key, JSON.stringify(basePayload));
    await deletePhotosFromIndexedDb(key);
    return { saved: true, photosSaved: true, savedAt };
  } catch {
    // 2. Fallback: simpan foto di IndexedDB dan teks di LocalStorage
    const idbSaved =
      sanitizedAttachments.length > 0
        ? await savePhotosToIndexedDb(key, sanitizedAttachments)
        : true;

    const textPayload: ReportDraftData = {
      ...basePayload,
      attachments: [],
      photosInIndexedDb: idbSaved && sanitizedAttachments.length > 0,
    };

    try {
      localStorage.setItem(key, JSON.stringify(textPayload));
      return { saved: true, photosSaved: idbSaved, savedAt };
    } catch {
      return { saved: false, photosSaved: false, savedAt };
    }
  }
}

/**
 * Memuat draf tersimpan dari LocalStorage (dan IndexedDB jika foto disimpan di sana).
 * Otomatis membersihkan entri korup/tidak valid.
 */
export async function loadReportDraft(
  userScope?: string | null
): Promise<ReportDraftData | null> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const key = buildDraftStorageKey(userScope);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  const parsed = parseDraftPayload(raw);
  if (!parsed) {
    // Bersihkan data draf yang korup atau tidak valid
    await clearReportDraft(userScope);
    return null;
  }

  if (parsed.photosInIndexedDb && parsed.attachments.length === 0) {
    const idbPhotos = await loadPhotosFromIndexedDb(key);
    parsed.attachments = idbPhotos;
  }

  if (!isDraftMeaningful(parsed)) {
    await clearReportDraft(userScope);
    return null;
  }

  return parsed;
}

/**
 * Menghapus draf tersimpan secara penuh dari LocalStorage maupun IndexedDB.
 */
export async function clearReportDraft(userScope?: string | null): Promise<void> {
  const key = buildDraftStorageKey(userScope);

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Abaikan error storage
    }
  }

  await deletePhotosFromIndexedDb(key);
}
