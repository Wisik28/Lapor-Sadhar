/**
 * Helper penyimpanan lokal untuk melacak laporan berstatus "Terkirim"
 * yang sudah pernah dibuka oleh admin agar penanda belum dibaca konsisten
 * antara /admin/dashboard dan /admin/prioritas.
 */

const STORAGE_PREFIX = "lapor_sadhar_admin_seen_reports_v1:";
const MAX_STORED_IDS = 1000;

export function resolveAdminSeenKey(user?: {
  admin_id?: number | string;
  username?: string;
  jabatan?: string;
} | null): string {
  const identity =
    (user?.admin_id !== undefined && user?.admin_id !== null && String(user.admin_id).trim()) ||
    (user?.username ?? "").trim() ||
    (user?.jabatan ?? "").trim() ||
    "default";
  return `${STORAGE_PREFIX}${identity}`;
}

export function loadSeenReportIds(storageKey: string): Set<number> {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set<number>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(
      parsed
        .map((val) => Number(val))
        .filter((num) => Number.isFinite(num) && num > 0)
    );
  } catch {
    return new Set<number>();
  }
}

export function persistSeenReportId(
  storageKey: string,
  reportId: number,
  current?: Set<number>
): Set<number> {
  const next = new Set(current ?? loadSeenReportIds(storageKey));
  if (!Number.isFinite(reportId) || reportId <= 0) return next;
  if (next.has(reportId)) return next;

  next.add(reportId);

  if (typeof window !== "undefined") {
    try {
      const list = Array.from(next);
      const trimmed = list.length > MAX_STORED_IDS ? list.slice(list.length - MAX_STORED_IDS) : list;
      window.localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      // Abaikan error quota localStorage
    }
  }

  return next;
}

