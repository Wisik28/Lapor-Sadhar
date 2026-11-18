export const adminPositions = [
  { value: "wakil_rektor_ii", label: "Wakil Rektor II" },
  { value: "kepala_blu", label: "Kepala Biro Layanan Umum" },
  { value: "kepala_bps", label: "Kepala Biro Sarana dan Prasarana" },
  { value: "kepala_bagian_blu_1", label: "Kepala Bagian BLU 1" },
  { value: "kepala_bagian_blu_2", label: "Kepala Bagian BLU 2" },
  { value: "kepala_bagian_blu_3", label: "Kepala Bagian BLU 3" },
  { value: "kepala_bagian_blu_4", label: "Kepala Bagian BLU 4" },
  { value: "kepala_bagian_bps_1", label: "Kepala Bagian BPS 1" },
  { value: "kepala_bagian_bps_2", label: "Kepala Bagian BPS 2" },
  { value: "kepala_bagian_bps_3", label: "Kepala Bagian BPS 3" },
  { value: "kepala_bagian_bps_4", label: "Kepala Bagian BPS 4" },
] as const;

export type AdminPosition = (typeof adminPositions)[number]["value"];

export interface AdminIdentity {
  campus?: string | null;
  role_detail?: string | null;
  jabatan?: string | null;
  jabatan_label?: string | null;
  username?: string | null;
}

export const KATEGORI_LAPORAN_OPTIONS = ["Kebersihan", "Fasilitas"] as const;
export type KategoriLaporanOption = (typeof KATEGORI_LAPORAN_OPTIONS)[number];

/**
 * Mengembalikan nama kampus (Kampus 1-4) jika admin dibatasi pada satu kampus tertentu,
 * atau null jika admin mencakup seluruh kampus.
 */
export function resolveAdminCampus(user?: AdminIdentity | null): string | null {
  if (!user) return null;

  const explicitCampus = (user.campus ?? "").trim();
  if (explicitCampus) return explicitCampus;

  const jabatan = (user.jabatan ?? "").trim().toLowerCase();
  const jabatanMatch = jabatan.match(/^kepala_bagian_(?:blu|bps)_([1-4])$/);
  if (jabatanMatch) return `Kampus ${jabatanMatch[1]}`;

  const label = (user.jabatan_label ?? "").trim().toLowerCase();
  const labelMatch = label.match(/\bkepala bagian (?:blu|bps)\s+([1-4])\b/);
  if (labelMatch) return `Kampus ${labelMatch[1]}`;

  const username = (user.username ?? "").trim().toLowerCase();
  const usernameMatch = username.match(/^(?:blu|bps)\.kampus([1-4])$/);
  if (usernameMatch) return `Kampus ${usernameMatch[1]}`;

  return null;
}

/**
 * Memeriksa apakah akun admin terikat pada satu kampus spesifik (mis. Kepala Bagian BLU/BPS 1-4).
 */
export function isCampusScopedAdmin(user?: AdminIdentity | null): boolean {
  return resolveAdminCampus(user) !== null;
}

/**
 * Memeriksa apakah akun admin yang aktif merupakan Wakil Rektor II (role BOTH).
 */
export function isWakilRektorII(user?: AdminIdentity | null): boolean {
  if (!user) return false;

  const roleDetail = (user.role_detail ?? "").trim().toUpperCase();
  const jabatan = (user.jabatan ?? "").trim().toLowerCase();
  const label = (user.jabatan_label ?? "").trim().toLowerCase();
  const username = (user.username ?? "").trim().toLowerCase();

  return (
    roleDetail === "BOTH" ||
    jabatan === "wakil_rektor_ii" ||
    label.includes("wakil rektor ii") ||
    label.includes("wakil rektor 2") ||
    label.includes("wr ii") ||
    label.includes("wr 2") ||
    username === "admin.wr2" ||
    username === "admin.wakil_rektor_ii" ||
    username === "wr2@gmail.com"
  );
}

/**
 * Menormalkan label kategori laporan menjadi Kebersihan atau Fasilitas.
 */
export function normalizeKategoriLaporan(kategori?: string | null): KategoriLaporanOption {
  const val = (kategori ?? "").trim().toLowerCase();
  if (val.includes("kebersihan") || val === "blu") {
    return "Kebersihan";
  }
  return "Fasilitas";
}

/**
 * Mengembalikan kelas warna teks untuk kolom Kategori Laporan pada dashboard WR 2.
 */
export function getKategoriTextColorClass(kategori?: string | null): string {
  return normalizeKategoriLaporan(kategori) === "Kebersihan"
    ? "text-green-600"
    : "text-orange-600";
}
