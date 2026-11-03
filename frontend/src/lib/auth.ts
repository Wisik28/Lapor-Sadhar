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

// Session timeout: 60 menit (dalam milliseconds)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Set auth session di localStorage dan cookies (via API route untuk cookies)
 * Tambahkan timestamp login untuk tracking session expiry
 */
export async function setAuthSession(user: AuthUser, token: string, isAdmin: boolean = false) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const sessionData = {
    user,
    loginTime: now,
    expiryTime: now + SESSION_TIMEOUT_MS,
  };

  // Simpan di localStorage
  localStorage.setItem("user_session", JSON.stringify(user));
  localStorage.setItem("session_login_time", now.toString());
  localStorage.setItem("session_expiry_time", sessionData.expiryTime.toString());
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
        loginTime: now,
        expiryTime: sessionData.expiryTime,
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
  localStorage.removeItem("session_login_time");
  localStorage.removeItem("session_expiry_time");
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
 * Check apakah session sudah expired (60 menit)
 */
export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return true;

  const expiryTime = localStorage.getItem("session_expiry_time");
  if (!expiryTime) return true;

  return Date.now() > parseInt(expiryTime);
}

/**
 * Get remaining session time dalam menit
 */
export function getSessionRemainingTime(): number {
  if (typeof window === "undefined") return 0;

  const expiryTime = localStorage.getItem("session_expiry_time");
  if (!expiryTime) return 0;

  const remainingMs = parseInt(expiryTime) - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / (60 * 1000)) : 0;
}

/**
 * Get current authenticated user dari localStorage
 */
export function getCurrentAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  // Check session expiry first
  if (isSessionExpired()) {
    clearAuthSession();
    return null;
  }

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

  // Check session expiry first
  if (isSessionExpired()) {
    clearAuthSession(isAdmin);
    return null;
  }

  const tokenKey = isAdmin ? "admin_token" : "auth_token";
  return localStorage.getItem(tokenKey);
}

/**
 * Check apakah user sudah authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  // Check session expiry first
  if (isSessionExpired()) {
    clearAuthSession();
    return false;
  }

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
