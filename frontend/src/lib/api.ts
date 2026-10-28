// Client API Helper untuk terhubung ke Backend Laravel

import { setAuthSession, clearAuthSession } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface UserSession {
  nomor_identitas?: string;
  nim?: string;
  admin_id?: number | string;
  username?: string;
  nama: string;
  no_handphone?: string;
  campus?: string;
  role_detail?: string;
  tipe_user?: "mahasiswa" | "karyawan" | string;
  role: "Mahasiswa" | "Karyawan" | "Admin" | string;
}

export interface AuthResponse {
  status: "success" | "error";
  message: string;
  token?: string;
  user?: UserSession;
  redirect_to?: string;
  errors?: Record<string, string[]>;
}

export interface StatusLaporan {
  id_status: number;
  id_laporan: number;
  status_laporan: "Terkirim" | "Diverifikasi" | "Diproses" | "Selesai" | "Ditolak";
  tanggal_merubah: string;
}

export interface LaporanItem {
  id_laporan: number;
  nim: string;
  nama_pelapor?: string;
  kategori_laporan: "Fasilitas" | "Kebersihan";
  deskripsi: string;
  tanggal_kejadian: string;
  tanggal_buat: string;
  tanggal_rubah?: string | null;
  lokasi: string;
  foto?: string | null;
  status_terkini: "Terkirim" | "Diverifikasi" | "Diproses" | "Selesai" | "Ditolak";
  riwayat_status: StatusLaporan[];
}

export interface LaporanResponse {
  status: "success" | "error";
  message?: string;
  data?: LaporanItem | LaporanItem[];
  total?: number;
  errors?: Record<string, string[]>;
}

// ─── Auth API ───────────────────────────────────────────────────────────────

export const authApi = {
  async adminLogin(credentials: {
    username: string;
    password: string;
    role: "BLU" | "BPS";
    campus: "Kampus I" | "Kampus II" | "Kampus III" | "Kampus IV";
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      if (response.ok && result.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, true);
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal menghubungi server backend."),
      };
    }
  },

  async getAdminSession(): Promise<AuthResponse> {
    try {
      const token = sessionStorage.getItem("admin_token");
      if (!token) return { status: "error", message: "Sesi admin tidak ditemukan." };

      const response = await fetch(`${API_BASE_URL}/admin/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result.status === "success" && result.user) {
        localStorage.setItem("user_session", JSON.stringify(result.user));
        return result;
      }

      localStorage.removeItem("user_session");
      sessionStorage.removeItem("admin_token");
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memeriksa sesi admin.") };
    }
  },

  async adminLogout(): Promise<void> {
    try {
      const token = sessionStorage.getItem("admin_token");
      if (token) {
        await fetch(`${API_BASE_URL}/admin/logout`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
      }
    } catch {
    } finally {
      await clearAuthSession(true);
    }
  },

  async changeAdminPassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    try {
      const token = sessionStorage.getItem("admin_token");
      const response = await fetch(`${API_BASE_URL}/admin/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengubah kata sandi.") };
    }
  },

  async register(data: {
    tipe_user: "mahasiswa" | "karyawan";
    nomor_identitas: string;
    nama: string;
    no_handphone: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (response.ok && result.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, false);
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal menghubungi server backend. Pastikan server Laravel aktif di port 8000."),
      };
    }
  },

  async login(credentials: {
    identifier: string;
    password: string;
    role?: "mahasiswa" | "karyawan" | "semua";
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      if (response.ok && result.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, false);
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal menghubungi server backend. Pastikan server Laravel aktif di port 8000."),
      };
    }
  },

  async logout(): Promise<void> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // Ignore error on logout network fail
    } finally {
      await clearAuthSession(false);
    }
  },

  getCurrentUser(): UserSession | null {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("user_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },
};

// ─── Laporan API ─────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const laporanApi = {
  /** Ambil semua laporan milik user berdasarkan NIM */
  async getAll(nim: string): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan?nim=${encodeURIComponent(nim)}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengambil data laporan.") };
    }
  },

  /** Ambil detail satu laporan */
  async getById(id: number): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan/${id}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengambil detail laporan.") };
    }
  },

  /** Buat laporan baru */
  async create(data: {
    nim: string;
    kategori_laporan: string;
    deskripsi: string;
    tanggal_kejadian: string;
    lokasi: string;
    foto?: string;
  }): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengirim laporan.") };
    }
  },

  /** Update / Rubah laporan (hanya jika status Terkirim) */
  async update(
    id: number,
    data: Partial<{
      kategori_laporan: string;
      deskripsi: string;
      tanggal_kejadian: string;
      lokasi: string;
      foto: string;
    }>
  ): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui laporan.") };
    }
  },

  /** Hapus laporan (hanya jika status Terkirim) */
  async delete(id: number): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal menghapus laporan.") };
    }
  },
};

// ─── Admin Laporan API ──────────────────────────────────────────────────────

export const adminLaporanApi = {
  /** Mengambil seluruh laporan untuk halaman admin */
  async getAll() {
    const response = await fetch(`${API_BASE_URL}/admin/laporan`, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          `Gagal mengambil laporan. HTTP ${response.status}`
      );
    }

    // Mendukung respons Laravel berbentuk { data: [...] }
    // maupun array laporan secara langsung.
    return Array.isArray(result) ? result : result?.data ?? [];
  },

  /** Mengubah status laporan dan menyimpan tanggapan admin */
  async updateStatus(
    id: number,
    status: string,
    pesan_tanggapan?: string
  ) {
    const response = await fetch(
      `${API_BASE_URL}/admin/laporan/${id}/status`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status_laporan: status,
          pesan_tanggapan: pesan_tanggapan ?? "",
        }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          `Gagal memperbarui status. HTTP ${response.status}`
      );
    }

    return result;
  },
};
