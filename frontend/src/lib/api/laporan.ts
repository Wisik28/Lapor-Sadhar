/**
 * Laporan API Client - Shared operations untuk semua fitur laporan
 */

import { LaporanItem, LaporanResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
      const res = await fetch(`${API_BASE_URL}/laporan?nim=${encodeURIComponent(nim)}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: 'error', message: getErrorMessage(error, 'Gagal mengambil data laporan.') };
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
      return { status: 'error', message: getErrorMessage(error, 'Gagal mengambil detail laporan.') };
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
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: 'error', message: getErrorMessage(error, 'Gagal mengirim laporan.') };
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
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: 'error', message: getErrorMessage(error, 'Gagal memperbarui laporan.') };
    }
  },

  /** Hapus laporan (hanya jika status Terkirim) */
  async delete(id: number): Promise<LaporanResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/laporan/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (error: unknown) {
      return { status: 'error', message: getErrorMessage(error, 'Gagal menghapus laporan.') };
    }
  },
};
