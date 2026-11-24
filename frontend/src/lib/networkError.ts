/**
 * Utilitas terpusat untuk penanganan error jaringan / offline
 * agar aplikasi tidak menampilkan kode atau pesan error mentah kepada pengguna.
 */

export type ErrorContext = 'load' | 'submit' | 'action';

export const FRIENDLY_NETWORK_MESSAGES: Record<ErrorContext, string> = {
  load: 'Gagal memuat data. Periksa koneksi internet Anda dan coba lagi.',
  submit: 'Gagal mengirim data. Periksa koneksi internet Anda dan coba lagi.',
  action: 'Gagal memproses permintaan. Periksa koneksi internet Anda dan coba lagi.',
};

export const FRIENDLY_SERVER_MESSAGES: Record<ErrorContext, string> = {
  load: 'Gagal memuat data karena terjadi gangguan pada server. Silakan coba lagi beberapa saat lagi.',
  submit: 'Gagal mengirim data karena terjadi gangguan pada server. Silakan coba lagi beberapa saat lagi.',
  action: 'Permintaan belum dapat diproses karena gangguan server. Silakan coba lagi beberapa saat lagi.',
};

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /err_internet_disconnected/i,
  /err_network/i,
  /err_connection/i,
  /err_name_not_resolved/i,
  /econnrefused/i,
  /econnreset/i,
  /enotfound/i,
  /etimedout/i,
  /connection refused/i,
  /the internet connection appears to be offline/i,
  /fetch failed/i,
  /gagal menghubungi server/i,
  /gagal terhubung ke server/i,
  /periksa koneksi internet/i,
];

const RAW_TECHNICAL_PATTERNS = [
  /\bhttp\s*\d{3}\b/i,
  /\bsqlstate\b/i,
  /\bsyntaxerror\b/i,
  /\btypeerror\b/i,
  /\breferenceerror\b/i,
  /unexpected token/i,
  /json\.parse/i,
  /is not valid json/i,
  /unexpected end of json/i,
  /stack trace/i,
  /pdoexception/i,
  /queryexception/i,
  /port\s*8000/i,
  /localhost:\d+/i,
  /internal server error/i,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
];

export class NetworkRequestError extends Error {
  readonly isNetworkError = true;

  constructor(message: string) {
    super(message);
    this.name = 'NetworkRequestError';
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  );
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkRequestError) {
    return true;
  }

  if (isOffline()) {
    return true;
  }

  if (error instanceof TypeError) {
    const msg = error.message || '';
    if (!msg || NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(msg))) {
      return true;
    }
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message) {
    return false;
  }

  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function isRawTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  return (
    NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    RAW_TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed))
  );
}

/**
 * Mengubah error mentah (jaringan, HTTP 5xx, parse error, dsb.) menjadi pesan yang ramah pengguna.
 */
export function formatUserFriendlyError(
  error: unknown,
  context: ErrorContext = 'load',
  fallback?: string
): string {
  if (isNetworkError(error)) {
    return FRIENDLY_NETWORK_MESSAGES[context];
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (rawMessage && !isRawTechnicalMessage(rawMessage)) {
    return rawMessage;
  }

  if (fallback && !isRawTechnicalMessage(fallback)) {
    return fallback;
  }

  return FRIENDLY_SERVER_MESSAGES[context];
}

/**
 * Mengambil pesan error yang ramah pengguna dari respons HTTP yang tidak ok.
 */
export function extractResponseErrorMessage(
  response: Response,
  parsedBody: unknown,
  context: ErrorContext = 'load',
  fallback?: string
): string {
  if (response.status >= 500 || response.status === 0) {
    return FRIENDLY_SERVER_MESSAGES[context];
  }

  if (parsedBody && typeof parsedBody === 'object') {
    const body = parsedBody as {
      message?: unknown;
      errors?: Record<string, unknown>;
    };

    if (typeof body.message === 'string' && !isRawTechnicalMessage(body.message)) {
      return body.message;
    }

    if (body.errors && typeof body.errors === 'object') {
      const firstErrorList = Object.values(body.errors)[0];
      if (
        Array.isArray(firstErrorList) &&
        typeof firstErrorList[0] === 'string' &&
        !isRawTechnicalMessage(firstErrorList[0])
      ) {
        return firstErrorList[0];
      }
    }
  }

  if (response.status === 401) {
    return 'Sesi Anda telah berakhir. Silakan login kembali.';
  }

  if (response.status === 403) {
    return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  }

  if (response.status === 404) {
    return fallback || 'Data yang diminta tidak ditemukan.';
  }

  if (response.status === 429) {
    return 'Terlalu banyak permintaan. Silakan tunggu sebentar lalu coba lagi.';
  }

  return fallback || FRIENDLY_SERVER_MESSAGES[context];
}

/**
 * Wrapper fetch yang mendeteksi kondisi offline dan mengubah kegagalan jaringan
 * menjadi NetworkRequestError dengan pesan yang ramah pengguna.
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  context: ErrorContext = 'load'
): Promise<Response> {
  if (isOffline()) {
    throw new NetworkRequestError(FRIENDLY_NETWORK_MESSAGES[context]);
  }

  try {
    return await fetch(input, init);
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new NetworkRequestError(FRIENDLY_NETWORK_MESSAGES[context]);
  }
}
