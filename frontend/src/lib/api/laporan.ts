/**
 * Laporan API Client - Shared operations untuk semua fitur laporan
 */

import { LaporanResponse } from './types';
import {
  extractResponseErrorMessage,
  formatUserFriendlyError,
  safeFetch,
} from '@/lib/networkError';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const laporanApi = {
  /** Ambil semua laporan milik user berdasarkan NIM */
  async getAll(nim: string): Promise<LaporanResponse> {
    try {
      const res = await safeFetch(
        `${API_BASE_URL}/laporan?nim=${encodeURIComponent(nim)}`,
        {
          headers: getAuthHeaders(),
          cache: 'no-store',
        },
        'load'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          status: 'error',
          message: extractResponseErrorMessage(res, result, 'load', 'Gagal memuat data laporan.'),
        };
      }
      if (!result) {
        return {
          status: 'error',
          message: 'Gagal memuat data laporan. Silakan coba lagi.',
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: 'error',
        message: formatUserFriendlyError(error, 'load'),
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
          cache: 'no-store',
        },
        'load'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          status: 'error',
          message: extractResponseErrorMessage(res, result, 'load', 'Gagal memuat detail laporan.'),
        };
      }
      if (!result) {
        return {
          status: 'error',
          message: 'Gagal memuat detail laporan. Silakan coba lagi.',
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: 'error',
        message: formatUserFriendlyError(error, 'load'),
      };
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
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        },
        'submit'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          status: 'error',
          message: extractResponseErrorMessage(res, result, 'submit', 'Gagal mengirim laporan. Silakan coba lagi.'),
          errors: result?.errors,
        };
      }
      if (!result) {
        return {
          status: 'error',
          message: 'Gagal mengirim laporan. Silakan coba lagi.',
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: 'error',
        message: formatUserFriendlyError(error, 'submit'),
      };
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
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        },
        'submit'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          status: 'error',
          message: extractResponseErrorMessage(res, result, 'submit', 'Gagal memperbarui laporan. Silakan coba lagi.'),
          errors: result?.errors,
        };
      }
      if (!result) {
        return {
          status: 'error',
          message: 'Gagal memperbarui laporan. Silakan coba lagi.',
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: 'error',
        message: formatUserFriendlyError(error, 'submit'),
      };
    }
  },

  /** Hapus laporan (hanya jika status Terkirim) */
  async delete(id: number): Promise<LaporanResponse> {
    try {
      const res = await safeFetch(
        `${API_BASE_URL}/laporan/${id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
        'action'
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          status: 'error',
          message: extractResponseErrorMessage(res, result, 'action', 'Gagal menghapus laporan. Silakan coba lagi.'),
        };
      }
      if (!result) {
        return {
          status: 'error',
          message: 'Gagal menghapus laporan. Silakan coba lagi.',
        };
      }
      return result;
    } catch (error: unknown) {
      return {
        status: 'error',
        message: formatUserFriendlyError(error, 'action'),
      };
    }
  },
};
