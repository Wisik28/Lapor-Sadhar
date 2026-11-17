// Client API untuk Dashboard Prioritas (Mendukung Admin & Pelapor)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getPriorityAuthHeaders() {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("admin_token") || localStorage.getItem("auth_token"))
    : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getPriorityEndpointPrefix() {
  if (typeof window !== "undefined" && localStorage.getItem("admin_token")) {
    return "admin/priority";
  }
  return "priority";
}

export type SeverityLevel = "berat" | "sedang" | "ringan";
export type PriorityLevel = "kritis" | "tinggi" | "sedang" | "rendah";
export type FotoAttachmentSource =
  | string
  | Array<string | { url?: string; path?: string }>
  | null;

export interface PriorityReportItem {
  id_laporan: number;
  nim: string;
  nama_pelapor: string;
  kategori_laporan: "Fasilitas" | "Kebersihan";
  deskripsi: string;
  tanggal_buat: string;
  tanggal_kejadian: string;
  lokasi: string;
  kategori_lokasi?: string;
  tingkat_keparahan_lokasi?: string;
  skala_keparahan_lokasi?: number;
  foto?: FotoAttachmentSource;
  fotos?: FotoAttachmentSource;
  attachments?: FotoAttachmentSource;
  has_foto?: boolean;
  status_terkini: string;
  lama_menunggu: string;
  lama_menunggu_hari: number;

  // Skor & Tingkat Prioritas
  priority_score: number;
  priority_level: PriorityLevel;
  severity_level: SeverityLevel;
  severity_source: "ai" | "admin" | "rule_fallback";
  ai_suggested_severity: SeverityLevel;
  admin_severity?: SeverityLevel | null;
  confidence: number;
  needs_review: boolean;
  reasons: string[];
  ringkasan_alasan: string;
  safety_flags: string[];
  admin_notes?: string | null;
  reviewed_at?: string | null;
}

export interface PrioritySummary {
  total_laporan: number;
  kritis_berat: number;
  tinggi: number;
  sedang: number;
  rendah: number;
  perlu_konfirmasi: number;
  rata_skor_prioritas: number;
}

export interface PriorityDetailLaporan {
  id_laporan?: number;
  nim?: string;
  kategori_laporan?: string;
  deskripsi?: string;
  tanggal_buat?: string;
  tanggal_kejadian?: string;
  lokasi?: string;
  kategori_lokasi?: string;
  tingkat_keparahan?: string;
  skala_keparahan?: number;
  foto?: FotoAttachmentSource;
}

export interface PriorityDetailAssessment {
  id?: number;
  id_laporan?: number;
  kategori?: string;
  kategori_lokasi?: string;
  tingkat_keparahan_lokasi?: string;
  skala_keparahan_lokasi?: number;
  severity_level?: SeverityLevel;
  severity_source?: string;
  ai_suggested_severity?: SeverityLevel;
  admin_severity?: SeverityLevel | null;
  priority_score?: number;
  priority_level?: PriorityLevel;
  confidence?: number;
  dimensions?: Record<string, number>;
  safety_flags?: string[];
  reasons?: string[];
  needs_review?: boolean;
  admin_notes?: string | null;
  admin_id?: number | null;
  reviewed_at?: string | null;
}

export interface PriorityDetailData {
  laporan: PriorityDetailLaporan;
  assessment: PriorityDetailAssessment;
  breakdown: Record<string, number>;
  feedback: Array<{
    id: number;
    admin_id?: number;
    original_level: string;
    corrected_level: string;
    note?: string;
    created_at: string;
    admin?: { nama_admin: string; jabatan: string };
  }>;
}

export interface PriorityFilterParams {
  kategori?: string;
  severity?: string;
  priority_level?: string;
  status?: string;
  needs_review?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

function buildReportFilterQueryString(params?: PriorityFilterParams): string {
  const searchParams = new URLSearchParams();
  if (params?.kategori && params.kategori !== "Semua") {
    searchParams.set("kategori", params.kategori);
  }
  if (params?.severity && params.severity !== "Semua") {
    searchParams.set("severity", params.severity);
  }
  if (params?.priority_level && params.priority_level !== "Semua") {
    searchParams.set("priority_level", params.priority_level);
  }
  if (params?.status && params.status !== "Semua") {
    searchParams.set("status", params.status);
  }
  if (params?.needs_review) {
    searchParams.set("needs_review", "1");
  }
  if (params?.search) {
    searchParams.set("search", params.search);
  }
  if (params?.page) {
    searchParams.set("page", params.page.toString());
  }
  if (params?.per_page) {
    searchParams.set("per_page", params.per_page.toString());
  }

  return searchParams.toString() ? `?${searchParams.toString()}` : "";
}

export interface PriorityReportsWithSummary {
  reports: PriorityReportItem[];
  summary: PrioritySummary | null;
  total?: number;
  per_page?: number;
  current_page?: number;
  last_page?: number;
}

export const priorityApi = {
  /**
   * Mengambil daftar laporan terurut prioritas sekaligus ringkasan dalam 1 request
   */
  async getReportsWithSummary(
    params?: PriorityFilterParams,
    signal?: AbortSignal
  ): Promise<PriorityReportsWithSummary> {
    const queryStr = buildReportFilterQueryString(params);
    const response = await fetch(`${API_BASE_URL}/${getPriorityEndpointPrefix()}/reports${queryStr}`, {
      method: "GET",
      headers: getPriorityAuthHeaders(),
      cache: "no-store",
      signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal memuat laporan prioritas (HTTP ${response.status})`);
    }

    return {
      reports: result?.data ?? [],
      summary: result?.summary ?? null,
      total: result?.total,
      per_page: result?.per_page,
      current_page: result?.current_page,
      last_page: result?.last_page,
    };
  },

  /**
   * Mengambil daftar laporan terurut prioritas dengan filter opsional
   */
  async getReports(params?: PriorityFilterParams, signal?: AbortSignal): Promise<PriorityReportItem[]> {
    const { reports } = await this.getReportsWithSummary(params, signal);
    return reports;
  },

  /**
   * Mengambil detail laporan dan kalkulasi faktor skor
   */
  async getReportDetail(id: number, signal?: AbortSignal): Promise<PriorityDetailData> {
    const response = await fetch(`${API_BASE_URL}/${getPriorityEndpointPrefix()}/reports/${id}`, {
      method: "GET",
      headers: getPriorityAuthHeaders(),
      cache: "no-store",
      signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal memuat detail prioritas (HTTP ${response.status})`);
    }

    return result?.data;
  },

  /**
   * Admin menetapkan / menimpa tingkat kerusakan (Berat / Sedang / Ringan)
   */
  async updateSeverity(
    id: number,
    severity_level: SeverityLevel,
    admin_notes?: string
  ): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/admin/priority/reports/${id}/severity`, {
      method: "PATCH",
      headers: getPriorityAuthHeaders(),
      body: JSON.stringify({
        severity_level,
        admin_notes: admin_notes ?? "",
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal memperbarui tingkat kerusakan (HTTP ${response.status})`);
    }

    return result;
  },

  /**
   * Mengambil statistik ringkasan dashboard prioritas
   */
  async getSummary(signal?: AbortSignal): Promise<PrioritySummary> {
    const response = await fetch(`${API_BASE_URL}/${getPriorityEndpointPrefix()}/summary`, {
      method: "GET",
      headers: getPriorityAuthHeaders(),
      cache: "no-store",
      signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal memuat ringkasan prioritas (HTTP ${response.status})`);
    }

    return result?.data ?? {
      total_laporan: 0,
      kritis_berat: 0,
      tinggi: 0,
      sedang: 0,
      rendah: 0,
      perlu_konfirmasi: 0,
      rata_skor_prioritas: 0,
    };
  },

  /**
   * Memicu perhitungan ulang semua skor laporan aktif
   */
  async recalculateAll(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/priority/recalculate`, {
      method: "POST",
      headers: getPriorityAuthHeaders(),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal menghitung ulang (HTTP ${response.status})`);
    }
  },
};

