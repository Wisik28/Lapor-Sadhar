<?php

namespace App\Http\Controllers;

use App\Services\LaporanService;
use App\Http\Requests\Laporan\StoreLaporanRequest;
use App\Http\Requests\Laporan\UpdateLaporanRequest;
use App\Http\Requests\Laporan\UpdateStatusLaporanRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * LaporanController - HTTP Controller untuk fitur Laporan
 * Mengelola HTTP requests/responses dan delegasi ke Service
 */
class LaporanController extends Controller
{
    private LaporanService $laporanService;

    public function __construct(LaporanService $laporanService)
    {
        $this->laporanService = $laporanService;
    }

    /**
     * POST /api/laporan
     * Buat laporan baru
     */
    public function store(StoreLaporanRequest $request): JsonResponse
    {
        try {
            $laporan = $this->laporanService->createLaporan($request->validated());

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil dikirim!',
                'data'    => $laporan,
            ], 201);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * GET /api/laporan?nim=xxx
     * Ambil semua laporan milik user berdasarkan NIM
     */
    public function index(Request $request): JsonResponse
    {
        $nim = $request->query('nim');

        if (!$nim) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter NIM wajib disertakan.',
            ], 422);
        }

        try {
            $laporans = $this->laporanService->getAllLaporanByNim($nim);

            return response()->json([
                'status' => 'success',
                'data'   => $laporans,
                'total'  => count($laporans),
            ]);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * GET /api/laporan/{id}
     * Ambil detail satu laporan
     */
    public function show($id): JsonResponse
    {
        try {
            $laporan = $this->laporanService->getLaporanById($id);

            return response()->json([
                'status' => 'success',
                'data'   => $laporan,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * PUT /api/laporan/{id}
     * Update laporan (hanya jika status Terkirim)
     */
    public function update(UpdateLaporanRequest $request, $id): JsonResponse
    {
        try {
            $laporan = $this->laporanService->updateLaporan($id, $request->validated());

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil diperbarui!',
                'data'    => $laporan,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Exception $e) {
            if ($e->getCode() === 403) {
                return response()->json([
                    'status'  => 'error',
                    'message' => $e->getMessage(),
                ], 403);
            }
            return $this->handleError($e);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * DELETE /api/laporan/{id}
     * Hapus laporan (hanya jika status Terkirim)
     */
    public function destroy($id): JsonResponse
    {
        try {
            $this->laporanService->deleteLaporan($id);

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil dihapus.',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Exception $e) {
            if ($e->getCode() === 403) {
                return response()->json([
                    'status'  => 'error',
                    'message' => $e->getMessage(),
                ], 403);
            }
            return $this->handleError($e);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * GET /api/laporan/rekap?nim=xxx
     * Rekap laporan per user (statistik)
     */
    public function rekap(Request $request): JsonResponse
    {
        $nim = $request->query('nim');

        if (!$nim) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter NIM wajib disertakan.',
            ], 422);
        }

        try {
            $rekap = $this->laporanService->getRekapLaporanByNim($nim);

            return response()->json([
                'status' => 'success',
                'data'   => $rekap,
            ]);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * GET /api/admin/laporan
     * Admin: Ambil semua laporan
     */
    public function adminIndex(): JsonResponse
    {
        try {
            $laporans = $this->laporanService->getAllLaporanForAdmin();

            return response()->json([
                'status' => 'success',
                'data'   => $laporans,
            ]);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * PATCH /api/admin/laporan/{id}/status
     * Admin: Ubah status laporan dan simpan pesan tanggapan
     */
    public function adminUpdateStatus(UpdateStatusLaporanRequest $request, $id): JsonResponse
    {
        try {
            $hasil = $this->laporanService->updateStatusLaporan(
                $id,
                $request->input('status_laporan'),
                $request->input('pesan_tanggapan', '')
            );

            return response()->json([
                'status'  => 'success',
                'message' => 'Status laporan berhasil diperbarui.',
                'data'    => $hasil,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return $this->handleError($e);
        }
    }

    /**
     * Handle error responses
     */
    private function handleError(\Throwable $e): JsonResponse
    {
        $msg = $e->getMessage();

        if (str_contains($msg, 'could not find driver')) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Driver database pgsql belum dimuat. Silakan restart terminal "php artisan serve".',
            ], 500);
        }

        if (str_contains($msg, 'Unknown host') || str_contains($msg, 'Connection refused') || str_contains($msg, 'password authentication failed')) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Koneksi ke database gagal. Silakan periksa kembali konfigurasi .env.',
            ], 500);
        }

        return response()->json([
            'status'  => 'error',
            'message' => 'Terjadi kesalahan server: ' . $msg,
        ], 500);
    }
}
