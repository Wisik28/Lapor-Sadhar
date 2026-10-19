<?php

namespace App\Http\Controllers;

use App\Models\Laporan;
use App\Models\Status;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class LaporanController extends Controller
{
    /**
     * Buat Laporan Baru
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nim'              => 'required|string|exists:user_mahasiswa,nim',
            'kategori_laporan' => 'required|string|in:Fasilitas,Kebersihan',
            'deskripsi'        => 'required|string|min:10',
            'tanggal_kejadian' => 'required|date|before_or_equal:today',
            'lokasi'           => 'required|string|max:255',
            'foto'             => 'nullable|string',
        ], [
            'nim.required'              => 'NIM pelapor wajib diisi.',
            'nim.exists'                => 'NIM tidak ditemukan di sistem.',
            'kategori_laporan.required' => 'Kategori laporan wajib dipilih.',
            'kategori_laporan.in'       => 'Kategori harus Fasilitas atau Kebersihan.',
            'deskripsi.required'        => 'Deskripsi masalah wajib diisi.',
            'deskripsi.min'             => 'Deskripsi minimal 10 karakter.',
            'tanggal_kejadian.required' => 'Tanggal kejadian wajib diisi.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
            'lokasi.required'           => 'Lokasi kejadian wajib diisi.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $laporan = Laporan::create([
                'nim'              => $request->nim,
                'kategori_laporan' => $request->kategori_laporan,
                'deskripsi'        => $request->deskripsi,
                'tanggal_kejadian' => $request->tanggal_kejadian,
                'lokasi'           => $request->lokasi,
                'foto'             => $request->foto ?? null,
                'tanggal_buat'     => now(),
            ]);

            // Buat status awal: Terkirim
            Status::create([
                'id_laporan'     => $laporan->id_laporan,
                'status_laporan' => 'Terkirim',
                'tanggal_merubah' => now(),
            ]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil dikirim!',
                'data'    => $laporan->load('statuses'),
            ], 201);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Ambil semua laporan milik user (berdasarkan NIM)
     */
    public function index(Request $request)
    {
        $nim = $request->query('nim');

        if (!$nim) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter NIM wajib disertakan.',
            ], 422);
        }

        try {
            $laporans = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }])
                ->where('nim', $nim)
                ->orderBy('tanggal_buat', 'desc')
                ->get()
                ->map(function ($laporan) {
                    $latestStatus = $laporan->statuses->first();
                    return [
                        'id_laporan'       => $laporan->id_laporan,
                        'nim'              => $laporan->nim,
                        'kategori_laporan' => $laporan->kategori_laporan,
                        'deskripsi'        => $laporan->deskripsi,
                        'tanggal_kejadian' => $laporan->tanggal_kejadian,
                        'tanggal_buat'     => $laporan->tanggal_buat,
                        'tanggal_rubah'    => $laporan->tanggal_rubah,
                        'lokasi'           => $laporan->lokasi,
                        'foto'             => $laporan->foto,
                        'status_terkini'   => $latestStatus?->status_laporan ?? 'Terkirim',
                        'riwayat_status'   => $laporan->statuses,
                    ];
                });

            return response()->json([
                'status' => 'success',
                'data'   => $laporans,
                'total'  => $laporans->count(),
            ]);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Ambil detail satu laporan
     */
    public function show($id)
    {
        try {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }, 'userMahasiswa'])->findOrFail($id);

            $latestStatus = $laporan->statuses->first();

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'id_laporan'       => $laporan->id_laporan,
                    'nim'              => $laporan->nim,
                    'nama_pelapor'     => $laporan->userMahasiswa?->nama,
                    'kategori_laporan' => $laporan->kategori_laporan,
                    'deskripsi'        => $laporan->deskripsi,
                    'tanggal_kejadian' => $laporan->tanggal_kejadian,
                    'tanggal_buat'     => $laporan->tanggal_buat,
                    'tanggal_rubah'    => $laporan->tanggal_rubah,
                    'lokasi'           => $laporan->lokasi,
                    'foto'             => $laporan->foto,
                    'status_terkini'   => $latestStatus?->status_laporan ?? 'Terkirim',
                    'riwayat_status'   => $laporan->statuses,
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Rubah / Update Pengajuan Laporan
     * Hanya bisa diubah jika status masih "Terkirim"
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'kategori_laporan' => 'sometimes|required|string|in:Fasilitas,Kebersihan',
            'deskripsi'        => 'sometimes|required|string|min:10',
            'tanggal_kejadian' => 'sometimes|required|date|before_or_equal:today',
            'lokasi'           => 'sometimes|required|string|max:255',
            'foto'             => 'nullable|string',
        ], [
            'kategori_laporan.in'              => 'Kategori harus Fasilitas atau Kebersihan.',
            'deskripsi.min'                    => 'Deskripsi minimal 10 karakter.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }])->findOrFail($id);

            // Cek apakah laporan masih bisa diubah (hanya jika status "Terkirim")
            $latestStatus = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';

            if ($latestStatus !== 'Terkirim') {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Laporan tidak dapat diubah karena statusnya sudah \"$latestStatus\". Hanya laporan berstatus \"Terkirim\" yang dapat diperbarui.",
                ], 403);
            }

            $laporan->update([
                'kategori_laporan' => $request->input('kategori_laporan', $laporan->kategori_laporan),
                'deskripsi'        => $request->input('deskripsi', $laporan->deskripsi),
                'tanggal_kejadian' => $request->input('tanggal_kejadian', $laporan->tanggal_kejadian),
                'lokasi'           => $request->input('lokasi', $laporan->lokasi),
                'foto'             => $request->input('foto', $laporan->foto),
                'tanggal_rubah'    => now(),
            ]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil diperbarui!',
                'data'    => $laporan->fresh()->load('statuses'),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Hapus Laporan (hanya jika status masih "Terkirim")
     */
    public function destroy($id)
    {
        try {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }])->findOrFail($id);

            $latestStatus = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';

            if ($latestStatus !== 'Terkirim') {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Laporan tidak dapat dihapus karena statusnya sudah \"$latestStatus\".",
                ], 403);
            }

            $laporan->delete();

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berhasil dihapus.',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Rekap Laporan per User (Statistik & Ringkasan)
     */
    public function rekap(Request $request)
    {
        $nim = $request->query('nim');

        if (!$nim) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter NIM wajib disertakan.',
            ], 422);
        }

        try {
            $laporans = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }])->where('nim', $nim)->get();

            // Hitung status terkini tiap laporan
            $statusCounts = [
                'Terkirim'    => 0,
                'Diverifikasi' => 0,
                'Diproses'    => 0,
                'Selesai'     => 0,
                'Ditolak'     => 0,
            ];

            $kategoriCounts = [
                'Fasilitas'  => 0,
                'Kebersihan' => 0,
            ];

            $bulanCounts = [];

            foreach ($laporans as $laporan) {
                // Status terkini
                $terkini = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';
                if (isset($statusCounts[$terkini])) {
                    $statusCounts[$terkini]++;
                }

                // Kategori
                $kat = $laporan->kategori_laporan;
                if (isset($kategoriCounts[$kat])) {
                    $kategoriCounts[$kat]++;
                }

                // Per bulan (berdasarkan tanggal_buat)
                $bulan = \Carbon\Carbon::parse($laporan->tanggal_buat)->format('Y-m');
                $bulanCounts[$bulan] = ($bulanCounts[$bulan] ?? 0) + 1;
            }

            // Urutkan bulan
            ksort($bulanCounts);

            // Format bulan ke label yang readable
            $bulanFormatted = [];
            foreach ($bulanCounts as $key => $count) {
                $bulanFormatted[] = [
                    'bulan'  => \Carbon\Carbon::createFromFormat('Y-m', $key)->locale('id')->isoFormat('MMMM YYYY'),
                    'key'    => $key,
                    'jumlah' => $count,
                ];
            }

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'nim'            => $nim,
                    'total_laporan'  => $laporans->count(),
                    'per_status'     => $statusCounts,
                    'per_kategori'   => $kategoriCounts,
                    'per_bulan'      => $bulanFormatted,
                    'laporan_aktif'  => $statusCounts['Terkirim'] + $statusCounts['Diverifikasi'] + $statusCounts['Diproses'],
                    'laporan_selesai' => $statusCounts['Selesai'],
                    'laporan_ditolak' => $statusCounts['Ditolak'],
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->handleDbError($e);
        }
    }

    /**
     * Handle Database Error Helper
     */
    private function handleDbError(\Throwable $e)
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
            'message' => 'Terjadi kesalahan server: ' . $e->getMessage(),
        ], 500);
    }
}
