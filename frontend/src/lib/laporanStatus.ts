export type StatusLaporanTerkini =
  | "Terkirim"
  | "Sedang Diverifikasi"
  | "Terverifikasi"
  | "Diproses"
  | "Selesai"
  | "Ditolak";

export function normalizeLaporanStatus(value?: string | null): StatusLaporanTerkini {
  const status = (value ?? "Terkirim")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

  if (status.includes("tolak")) return "Ditolak";
  if (status.includes("selesai")) return "Selesai";
  if (status.includes("proses") || status.includes("kerja")) return "Diproses";

  if (
    status.includes("sedang verifikasi") ||
    status.includes("sedang diverifikasi") ||
    (status.includes("verifikasi") && !status.includes("terverifikasi"))
  ) {
    return "Sedang Diverifikasi";
  }

  if (status.includes("terverifikasi") || status === "diverifikasi") {
    return "Terverifikasi";
  }

  return "Terkirim";
}
