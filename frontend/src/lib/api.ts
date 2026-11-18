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
  email?: string;
  nama: string;
  no_handphone?: string;
  campus?: string;
  role_detail?: string;
  jabatan?: string;
  jabatan_label?: string;
  tipe_user?: "mahasiswa" | "karyawan" | string;
  role: "Mahasiswa" | "Karyawan" | "Admin" | string;
}

export interface AuthResponse {
  status: "success" | "error";
  message: string;
  email?: string;
  token?: string;
  user?: UserSession;
  redirect_to?: string;
  errors?: Record<string, string[]>;
}

export interface StatusLaporan {
  id_status: number;
  id_laporan: number;
  status_laporan: "Terkirim" | "Diverifikasi" | "Sedang Diverifikasi" | "Terverifikasi" | "Proses" | "Diproses" | "Selesai" | "Ditolak";
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
  lokasi_kampus?: string | null;
  lokasi: string;
  foto?: string | null;
  status_terkini: "Terkirim" | "Diverifikasi" | "Sedang Diverifikasi" | "Terverifikasi" | "Proses" | "Diproses" | "Selesai" | "Ditolak";
  riwayat_status: StatusLaporan[];
  pesan_tanggapan?: string | null;
}

export interface LaporanResponse {
  status: "success" | "error";
  message?: string;
  data?: LaporanItem | LaporanItem[];
  total?: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
  errors?: Record<string, string[]>;
}

// ─── Auth API ───────────────────────────────────────────────────────────────

export const authApi = {
  async adminLogin(credentials: {
    username: string;
    password: string;
    jabatan: string;
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
      const token = localStorage.getItem("admin_token");
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
      localStorage.removeItem("admin_token");
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memeriksa sesi admin.") };
    }
  },

  async adminLogout(): Promise<void> {
    try {
      const token = localStorage.getItem("admin_token");
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
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
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

  async updateAdminProfile(data: { nama: string }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const response = await fetch(`${API_BASE_URL}/admin/profile`, {
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
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui profil admin.") };
    }
  },

  async requestAdminEmailChange(new_email: string): Promise<AuthResponse> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    return this.authenticatedRequest("/admin/email-change/request", { new_email }, token, "Gagal meminta kode verifikasi email admin.");
  },

  async confirmAdminEmailChange(code: string): Promise<AuthResponse> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    return this.authenticatedRequest("/admin/email-change/confirm", { code }, token, "Gagal memverifikasi email admin.");
  },

  async register(data: {
    tipe_user: "mahasiswa" | "karyawan";
    nomor_identitas: string;
    nama: string;
    email: string;
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

  async requestUserPasswordReset(email: string): Promise<AuthResponse> {
    return this.postAuth("/password/forgot", { email }, "Gagal meminta kode reset.");
  },

  async resetUserPassword(data: {
    email: string;
    code: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    return this.postAuth("/password/reset", data, "Gagal mereset kata sandi.");
  },

  async requestAdminPasswordReset(data: { username: string; jabatan: string }): Promise<AuthResponse> {
    return this.postAuth("/admin/password/forgot", data, "Gagal meminta kode reset admin.");
  },

  async resetAdminPassword(data: {
    username: string;
    jabatan: string;
    code: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    return this.postAuth("/admin/password/reset", data, "Gagal mereset kata sandi admin.");
  },

  async getUserSession(): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) return { status: "error", message: "Sesi pengguna tidak ditemukan." };

      const response = await fetch(`${API_BASE_URL}/profile/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result.status === "success" && result.user) {
        localStorage.setItem("user_session", JSON.stringify(result.user));
        return result;
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memeriksa sesi pengguna.") };
    }
  },

  async updateUserProfile(data: {
    nama?: string;
    no_handphone?: string;
    email?: string;
  }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const response = await fetch(`${API_BASE_URL}/profile`, {
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
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui profil pengguna.") };
    }
  },

  async changeUserPassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const response = await fetch(`${API_BASE_URL}/profile/password`, {
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

  async requestUserEmailChange(new_email: string): Promise<AuthResponse> {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return this.authenticatedRequest("/profile/email-change/request", { new_email }, token, "Gagal meminta kode verifikasi email.");
  },

  async confirmUserEmailChange(code: string): Promise<AuthResponse> {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return this.authenticatedRequest("/profile/email-change/confirm", { code }, token, "Gagal memverifikasi email.");
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

  async postAuth(path: string, data: Record<string, string>, fallback: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, fallback) };
    }
  },

  async authenticatedRequest(
    path: string,
    data: Record<string, string>,
    token: string | null,
    fallback: string,
  ): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, fallback) };
    }
  },
};

// ─── Laporan API ─────────────────────────────────────────────────────────────

function getAuthHeaders(isAdmin = false) {
  const token = typeof window !== "undefined"
    ? localStorage.getItem(isAdmin ? "admin_token" : "auth_token")
    : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const laporanApi = {
  /** Ambil semua laporan milik user berdasarkan NIM dengan opsi pagination */
  async getAll(
    nim: string,
    params?: { page?: number; per_page?: number }
  ): Promise<LaporanResponse> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("nim", nim);
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.per_page) searchParams.set("per_page", String(params.per_page));

      const res = await fetch(
        `${API_BASE_URL}/laporan?${searchParams.toString()}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          cache: "no-store",
        }
      );

    const result = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        status: "error",
        message:
          result?.message ||
          `Gagal mengambil laporan. HTTP ${res.status}`,
      };
    }

    if (!result) {
      return {
        status: "error",
        message: "Respons server tidak valid.",
      };
    }

    return result;
  } catch (error: unknown) {
    return {
      status: "error",
      message: getErrorMessage(
        error,
        "Gagal mengambil data laporan."
      ),
    };
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
    lokasi_kampus: string;
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
      lokasi_kampus: string;
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
  /** Mengambil seluruh laporan untuk halaman admin dengan opsi pagination */
  async getAll(params?: { page?: number; per_page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.per_page) searchParams.set("per_page", String(params.per_page));

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const response = await fetch(`${API_BASE_URL}/admin/laporan${query}`, {
      method: "GET",
      headers: getAuthHeaders(true),
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

  /** Mengambil laporan untuk halaman admin beserta metadata pagination */
  async getAllWithPagination(params?: { page?: number; per_page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.per_page) searchParams.set("per_page", String(params.per_page));

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const response = await fetch(`${API_BASE_URL}/admin/laporan${query}`, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          `Gagal mengambil laporan. HTTP ${response.status}`
      );
    }

    const items = Array.isArray(result) ? result : result?.data ?? [];
    return {
      data: items as LaporanItem[],
      total: result?.total ?? items.length,
      current_page: result?.current_page ?? (params?.page || 1),
      last_page: result?.last_page ?? 1,
      per_page: result?.per_page ?? (params?.per_page || 10),
    };
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
        headers: getAuthHeaders(true),
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

  /** Mengambil data rekap & analitik laporan untuk admin */
  async getRekap(params?: { bulan?: string; tahun?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.bulan) searchParams.set("bulan", params.bulan);
    else if (params?.tahun) searchParams.set("tahun", params.tahun);

    const url = `${API_BASE_URL}/admin/rekap${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || `Gagal mengambil rekap. HTTP ${response.status}`);
    }

    return result?.data ?? null;
  },
};
