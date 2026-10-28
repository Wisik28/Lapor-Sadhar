// Utilities untuk mengelola session autentikasi di client-side

export interface AuthUser {
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

/**
 * Set auth session di localStorage dan cookies (via API route untuk cookies)
 */
export async function setAuthSession(user: AuthUser, token: string, isAdmin: boolean = false) {
  if (typeof window === "undefined") return;

  // Simpan di localStorage
  localStorage.setItem("user_session", JSON.stringify(user));
  const tokenKey = isAdmin ? "admin_token" : "auth_token";
  localStorage.setItem(tokenKey, token);

  // Simpan ke cookies via API route (untuk middleware)
  try {
    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        token,
        isAdmin,
      }),
    });
  } catch (error) {
    console.error("Failed to set session cookie:", error);
  }
}

/**
 * Clear auth session dari localStorage dan cookies
 */
export async function clearAuthSession(isAdmin: boolean = false) {
  if (typeof window === "undefined") return;

  // Hapus dari localStorage
  localStorage.removeItem("user_session");
  const tokenKey = isAdmin ? "admin_token" : "auth_token";
  localStorage.removeItem(tokenKey);

  // Hapus cookies via API route
  try {
    await fetch("/api/auth/clear-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin }),
    });
  } catch (error) {
    console.error("Failed to clear session cookie:", error);
  }
}

/**
 * Get current authenticated user dari localStorage
 */
export function getCurrentAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("user_session");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Get auth token (user atau admin)
 */
export function getAuthToken(isAdmin: boolean = false): string | null {
  if (typeof window === "undefined") return null;
  const tokenKey = isAdmin ? "admin_token" : "auth_token";
  return localStorage.getItem(tokenKey);
}

/**
 * Check apakah user sudah authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const user = getCurrentAuthUser();
  const authToken = getAuthToken();
  const adminToken = getAuthToken(true);
  return !!(user && (authToken || adminToken));
}

/**
 * Check apakah user adalah admin
 */
export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const user = getCurrentAuthUser();
  return user?.role === "Admin";
}
