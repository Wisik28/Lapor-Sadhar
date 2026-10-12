// Client API Helper untuk terhubung ke Backend Laravel

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface UserSession {
  nomor_identitas?: string;
  nim?: string;
  admin_id?: number | string;
  username?: string;
  nama: string;
  no_handphone?: string;
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

export const authApi = {
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
      if (response.ok && result.status === "success") {
        if (typeof window !== "undefined" && result.user) {
          localStorage.setItem("user_session", JSON.stringify(result.user));
          if (result.token) localStorage.setItem("auth_token", result.token);
        }
      }
      return result;
    } catch (error: any) {
      return {
        status: "error",
        message: error.message || "Gagal menghubungi server backend. Pastikan server Laravel aktif di port 8000.",
      };
    }
  },

  async login(credentials: {
    identifier: string;
    password: string;
    role?: "mahasiswa" | "karyawan" | "admin" | "semua";
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
      if (response.ok && result.status === "success") {
        if (typeof window !== "undefined" && result.user) {
          localStorage.setItem("user_session", JSON.stringify(result.user));
          if (result.token) localStorage.setItem("auth_token", result.token);
        }
      }
      return result;
    } catch (error: any) {
      return {
        status: "error",
        message: error.message || "Gagal menghubungi server backend. Pastikan server Laravel aktif di port 8000.",
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
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_session");
        localStorage.removeItem("auth_token");
      }
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
