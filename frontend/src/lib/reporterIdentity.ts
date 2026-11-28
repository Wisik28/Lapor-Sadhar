const NIM_FORMAT_REGEX = /^\d{9}$/;

/**
 * Memeriksa apakah username/nomor identitas pelapor sesuai format NIM mahasiswa 9 digit (xxxxxxxxx).
 */
export function isNimFormat(identifier?: string | number | null): boolean {
  if (identifier === null || identifier === undefined) return false;
  return NIM_FORMAT_REGEX.test(String(identifier).trim());
}

/**
 * Mengembalikan label identitas pelapor:
 * "NIM" hanya dipakai untuk username berformat xxxxxxxxx (9 digit); selain itu "NIP".
 */
export function getReporterIdentityLabel(
  identifier?: string | number | null
): "NIM" | "NIP" {
  return isNimFormat(identifier) ? "NIM" : "NIP";
}

/**
 * Mengembalikan label peran pelapor ("Mahasiswa" atau "Karyawan") selaras dengan tipe_user dan format NIM.
 */
export function resolveReporterRoleLabel(
  identifier?: string | number | null,
  tipeUser?: string | null
): "Mahasiswa" | "Karyawan" {
  const normalizedType = (tipeUser || "").trim().toLowerCase();
  if (
    normalizedType.includes("karyawan") ||
    normalizedType.includes("pegawai") ||
    normalizedType.includes("dosen")
  ) {
    return "Karyawan";
  }
  if (!isNimFormat(identifier)) {
    return "Karyawan";
  }
  return "Mahasiswa";
}
