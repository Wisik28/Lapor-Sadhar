// Client API Helper untuk terhubung ke Backend Laravel

import { setAuthSession, clearAuthSession, syncSessionExpiry } from './auth';
import {
  extractResponseErrorMessage,
  formatUserFriendlyError,
  safeFetch,
  type ErrorContext,
} from './networkError';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getErrorMessage(
  error: unknown,
  fallback: string,
  context: ErrorContext = 'action'
): string {
  return formatUserFriendlyError(error, context, fallback);
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
  expires_at?: string;
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
  foto?: string | string[] | null;
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
  not_modified?: boolean;
  etag?: string | null;
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
      const response = await safeFetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(credentials),
      }, 'submit');

      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, true, result.expires_at);
        return result;
      }
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Username atau kata sandi admin tidak valid."),
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal masuk ke sistem. Periksa koneksi internet Anda dan coba lagi.", 'submit'),
      };
    }
  },

  async getAdminSession(): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return { status: "error", message: "Sesi admin tidak ditemukan." };

      const response = await safeFetch(`${API_BASE_URL}/admin/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }, 'load');
      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === "success" && result.user) {
        localStorage.setItem("user_session", JSON.stringify(result.user));
        syncSessionExpiry(result.expires_at);
        return result;
      }

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("user_session");
        localStorage.removeItem("admin_token");
      }
      return {
        status: "error",
        message: extractResponseErrorMessage(response, result, 'load', "Gagal memeriksa sesi admin."),
      };
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memeriksa sesi admin.", 'load') };
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
      const response = await safeFetch(`${API_BASE_URL}/admin/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }, 'submit');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Gagal mengubah kata sandi."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengubah kata sandi.", 'submit') };
    }
  },

  async updateAdminProfile(data: { nama: string }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const response = await safeFetch(`${API_BASE_URL}/admin/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }, 'submit');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Gagal memperbarui profil admin."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui profil admin.", 'submit') };
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
      const response = await safeFetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      }, 'submit');

      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, false, result.expires_at);
        return result;
      }
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Pendaftaran belum dapat diproses. Silakan coba lagi."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal mendaftar. Periksa koneksi internet Anda dan coba lagi.", 'submit'),
      };
    }
  },

  async login(credentials: {
    identifier: string;
    password: string;
    role?: "mahasiswa" | "karyawan" | "semua";
  }): Promise<AuthResponse> {
    try {
      const response = await safeFetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(credentials),
      }, 'submit');

      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === "success" && result.user && result.token) {
        await setAuthSession(result.user, result.token, false, result.expires_at);
        return result;
      }
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Gagal masuk. Periksa kembali data login Anda."),
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal masuk ke sistem. Periksa koneksi internet Anda dan coba lagi.", 'submit'),
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

      const response = await safeFetch(`${API_BASE_URL}/profile/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }, 'load');
      const result = await response.json().catch(() => null);
      if (response.ok && result?.status === "success" && result.user) {
        localStorage.setItem("user_session", JSON.stringify(result.user));
        syncSessionExpiry(result.expires_at);
        return result;
      }
      return {
        status: "error",
        message: extractResponseErrorMessage(response, result, 'load', "Gagal memeriksa sesi pengguna."),
      };
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memeriksa sesi pengguna.", 'load') };
    }
  },

  async updateUserProfile(data: {
    nama?: string;
    no_handphone?: string;
    email?: string;
  }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const response = await safeFetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }, 'submit');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Gagal memperbarui profil pengguna."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui profil pengguna.", 'submit') };
    }
  },

  async changeUserPassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthResponse> {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const response = await safeFetch(`${API_BASE_URL}/profile/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }, 'submit');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', "Gagal mengubah kata sandi."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengubah kata sandi.", 'submit') };
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
      const response = await safeFetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      }, 'submit');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'submit', fallback),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, fallback, 'submit') };
    }
  },

  async authenticatedRequest(
    path: string,
    data: Record<string, string>,
    token: string | null,
    fallback: string,
  ): Promise<AuthResponse> {
    try {
      const response = await safeFetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      }, 'action');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(response, result, 'action', fallback),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, fallback, 'action') };
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
  /** Ambil semua laporan milik user berdasarkan NIM dengan opsi pagination & conditional ETag */
  async getAll(
    nim: string,
    params?: { page?: number; per_page?: number; include_foto?: boolean; ifNoneMatch?: string | null }
  ): Promise<LaporanResponse> {
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("nim", nim);
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.per_page) searchParams.set("per_page", String(params.per_page));
      if (params?.include_foto === false) searchParams.set("include_foto", "0");

      const headers: Record<string, string> = {
        ...getAuthHeaders(),
        ...(params?.ifNoneMatch ? { "If-None-Match": params.ifNoneMatch } : {}),
      };

      const res = await safeFetch(
        `${API_BASE_URL}/laporan?${searchParams.toString()}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        },
        'load'
      );

      if (res.status === 304) {
        return {
          status: "success",
          not_modified: true,
          etag: res.headers.get("ETag") ?? params?.ifNoneMatch ?? null,
        };
      }

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          status: "error",
          message: extractResponseErrorMessage(res, result, 'load', "Gagal memuat data laporan. Silakan coba lagi."),
        };
      }

      if (!result) {
        return {
          status: "error",
          message: "Gagal memuat data laporan. Silakan coba lagi.",
        };
      }

      return {
        ...result,
        etag: res.headers.get("ETag"),
      };
    } catch (error: unknown) {
      return {
        status: "error",
        message: getErrorMessage(error, "Gagal memuat data. Periksa koneksi internet Anda dan coba lagi.", 'load'),
      };
    }
  },

  /** Ambil detail satu laporan */
  async getById(id: number): Promise<LaporanResponse> {
    try {
      const res = await safeFetch(
        `${API_BASE_URL}/laporan/${id}`,
        {
          headers: getAuthHeaders(),
          cache: "no-store",
        },
        'load'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(res, result, 'load', "Gagal memuat detail laporan. Silakan coba lagi."),
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memuat detail laporan.", 'load') };
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
      const res = await safeFetch(
        `${API_BASE_URL}/laporan`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        },
        'submit'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(res, result, 'submit', "Gagal mengirim laporan. Silakan coba lagi."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal mengirim laporan.", 'submit') };
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
      const res = await safeFetch(
        `${API_BASE_URL}/laporan/${id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        },
        'submit'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(res, result, 'submit', "Gagal memperbarui laporan. Silakan coba lagi."),
          errors: result?.errors,
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal memperbarui laporan.", 'submit') };
    }
  },

  /** Hapus laporan (hanya jika status Terkirim) */
  async delete(id: number): Promise<LaporanResponse> {
    try {
      const res = await safeFetch(
        `${API_BASE_URL}/laporan/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
        'action'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result) {
        return {
          status: "error",
          message: extractResponseErrorMessage(res, result, 'action', "Gagal menghapus laporan. Silakan coba lagi."),
        };
      }
      return result;
    } catch (error: unknown) {
      return { status: "error", message: getErrorMessage(error, "Gagal menghapus laporan.", 'action') };
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
    const response = await safeFetch(`${API_BASE_URL}/admin/laporan${query}`, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    }, 'load');

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractResponseErrorMessage(response, result, 'load', "Gagal memuat data laporan. Silakan coba lagi.")
      );
    }

    // Mendukung respons Laravel berbentuk { data: [...] }
    // maupun array laporan secara langsung.
    return Array.isArray(result) ? result : result?.data ?? [];
  },

  /** Mengambil laporan untuk halaman admin beserta metadata pagination */
  async getAllWithPagination(params?: { page?: number; per_page?: number; include_foto?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.per_page) searchParams.set("per_page", String(params.per_page));
    if (params?.include_foto === false) searchParams.set("include_foto", "0");

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const response = await safeFetch(`${API_BASE_URL}/admin/laporan${query}`, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    }, 'load');

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractResponseErrorMessage(response, result, 'load', "Gagal memuat data laporan. Silakan coba lagi.")
      );
    }

    const items = Array.isArray(result) ? result : result?.data ?? [];
    return {
      data: items as LaporanItem[],
      total: result?.total ?? items.length,
      current_page: result?.current_page ?? (params?.page || 1),
      last_page: result?.last_page ?? 1,
      per_page: result?.per_page ?? (params?.per_page || 20),
    };
  },

  /** Mengambil daftar ID laporan yang sudah pernah dibaca admin (tersimpan di database) */
  async getSeenReportIds(): Promise<number[]> {
    const response = await safeFetch(`${API_BASE_URL}/admin/laporan/seen`, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    }, 'load');

    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result?.data)) {
      return [];
    }

    return result.data
      .map((id: unknown) => Number(id))
      .filter((num: number) => Number.isFinite(num) && num > 0);
  },

  /** Menandai laporan sebagai sudah dibaca oleh admin saat ini di database */
  async markReportSeen(id: number): Promise<void> {
    if (!Number.isFinite(id) || id <= 0) return;
    await safeFetch(`${API_BASE_URL}/admin/laporan/${id}/seen`, {
      method: "POST",
      headers: getAuthHeaders(true),
    }, 'action');
  },

  /** Mengubah status laporan dan menyimpan tanggapan admin */
  async updateStatus(
    id: number,
    status: string,
    pesan_tanggapan?: string
  ) {
    const response = await safeFetch(
      `${API_BASE_URL}/admin/laporan/${id}/status`,
      {
        method: "PATCH",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          status_laporan: status,
          pesan_tanggapan: pesan_tanggapan ?? "",
        }),
      },
      'submit'
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractResponseErrorMessage(response, result, 'submit', "Gagal menyimpan pembaruan status. Silakan coba lagi.")
      );
    }

    return result;
  },

  /** Memindahkan laporan ke kategori/unit lain (BPS <-> BLU) jika pelapor salah memilih kategori */
  async transferKategori(
    id: number,
    kategori_laporan: "Fasilitas" | "Kebersihan",
    catatan_pemindahan?: string
  ) {
    const response = await safeFetch(
      `${API_BASE_URL}/admin/laporan/${id}/kategori`,
      {
        method: "PATCH",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          kategori_laporan,
          catatan_pemindahan: catatan_pemindahan?.trim() || undefined,
        }),
      },
      'action'
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractResponseErrorMessage(response, result, 'action', "Gagal memindahkan laporan. Silakan coba lagi.")
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
    const response = await safeFetch(url, {
      method: "GET",
      headers: getAuthHeaders(true),
      cache: "no-store",
    }, 'load');

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractResponseErrorMessage(response, result, 'load', "Gagal memuat data rekap. Silakan coba lagi.")
      );
    }

    return result?.data ?? null;
  },
};
