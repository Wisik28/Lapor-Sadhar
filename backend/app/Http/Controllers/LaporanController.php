<?php

namespace App\Http\Controllers;

use App\Models\Laporan;
use App\Services\LaporanService;
use App\Http\Requests\Laporan\StoreLaporanRequest;
use App\Http\Requests\Laporan\UpdateLaporanRequest;
use App\Http\Requests\Laporan\UpdateStatusLaporanRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

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
     * GET /api/laporan
     * Ambil semua laporan milik user yang sedang login (dari bearer token)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Ambil identitas pengguna dari sesi login (user_session middleware)
            $session = $request->attributes->get('user_session');
            $identifier = $session?->account_id;

            if (!$identifier) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Sesi pengguna tidak valid. Silakan login kembali.',
                    'data'    => [],
                ], 401);
            }

            // Ambil laporan berdasarkan identitas pengguna
            $laporans = Laporan::with([
                'statuses' => function ($query) {
                    $query->orderBy('tanggal_merubah', 'desc');
                }
            ])
                ->where('nim', $identifier)
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

                        // Status terbaru laporan
                        'status_terkini' => $latestStatus?->status_laporan ?? 'Terkirim',

                        // Seluruh riwayat perubahan status
                        'riwayat_status' => $laporan->statuses,

                        // Tanggapan admin
                        'pesan_tanggapan' => $laporan->pesan_tanggapan ?? '',
                    ];
                })
                ->values();

            return response()->json([
                'status'  => 'success',
                'message' => 'Data laporan berhasil dimuat.',
                'total'   => $laporans->count(),
                'data'    => $laporans,
            ], 200);

        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil data laporan.',
                'data'    => [],
            ], 500);
        }
    }

    /**
     * GET /api/laporan/{id}
     * Ambil detail satu laporan
     */
    public function show(Request $request, $id): JsonResponse
    {
        try {
            $session = $request->attributes->get('user_session');
            $identifier = $session?->account_id;

            if (!$identifier) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Sesi pengguna tidak valid. Silakan login kembali.',
                ], 401);
            }

            $laporan = Laporan::with('statuses')
                ->where('nim', $identifier)
                ->where('id_laporan', $id)
                ->firstOrFail();

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
     * GET /api/admin/laporan
     * Admin: Ambil semua laporan
     */
    public function adminIndex(): JsonResponse
    {
        try {
            $laporans = Laporan::with([
                'statuses' => function ($query) {
                    $query->orderBy('tanggal_merubah', 'desc');
                },
                'pelapor.mahasiswa',
            ])
                ->orderBy('tanggal_buat', 'desc')
                ->get()
                ->map(function ($laporan) {
                    $statusTerbaru = $laporan->statuses->first();

                    return [
                        'id_laporan'       => $laporan->id_laporan,
                        'nim'              => $laporan->nim,
                        'nama_pelapor'     => $laporan->pelapor?->mahasiswa?->nama ?? '-',
                        'kategori_laporan' => $laporan->kategori_laporan,
                        'deskripsi'        => $laporan->deskripsi,
                        'tanggal_kejadian' => $laporan->tanggal_kejadian,
                        'tanggal_buat'     => $laporan->tanggal_buat,
                        'tanggal_rubah'    => $laporan->tanggal_rubah,
                        'lokasi'           => $laporan->lokasi,
                        'foto'             => $laporan->foto,
                        'pesan_tanggapan'  => $laporan->pesan_tanggapan ?? '',
                        'status_terkini'   => $statusTerbaru?->status_laporan ?? 'Terkirim',
                        'riwayat_status'   => $laporan->statuses,
                    ];
                });

            return response()->json([
                'status' => 'success',
                'data'   => $laporans,
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil data laporan admin.',
            ], 500);
        }
    }

    /**
     * GET /api/admin/rekap
     * Admin: Rekap & Analitik Laporan untuk Admin (seluruh data)
     */
    public function adminRekap(Request $request): JsonResponse
    {
        try {
            $bulan = $request->query('bulan'); // format: "2026-10"
            $tahun = $request->query('tahun'); // format: "2026"

            $query = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
            }, 'pelapor.mahasiswa']);

            // Filter periode jika ada
            if ($bulan) {
                $query->whereRaw("TO_CHAR(tanggal_buat, 'YYYY-MM') = ?", [$bulan]);
            } elseif ($tahun) {
                $query->whereRaw("TO_CHAR(tanggal_buat, 'YYYY') = ?", [$tahun]);
            }

            $laporans = $query->orderBy('tanggal_buat', 'desc')->get();

            $statusCounts = [
                'Terkirim'     => 0,
                'Diverifikasi' => 0,
                'Diproses'     => 0,
                'Selesai'      => 0,
                'Ditolak'      => 0,
            ];

            $kategoriCounts = [
                'Fasilitas'  => 0,
                'Kebersihan' => 0,
            ];

            $lokasiCounts      = [];
            $bulanCounts       = [];
            $bulanSelesaiCount = []; // untuk chart 2-seri

            // ── Kalkulasi per laporan ─────────────────────────────────────────
            $resolusiJam     = [];
            $SLA_TARGET_JAM  = 24; // target SLA: 24 jam
            $selesaiDalamSLA = 0;

            foreach ($laporans as $laporan) {
                // Status terkini — normalisasi semua varian nama status ke bucket rekap
                $terkini = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';
                $bucket  = $this->normalizeBucketStatus($terkini);
                if (isset($statusCounts[$bucket])) {
                    $statusCounts[$bucket]++;
                }

                // Kategori
                $kat = $laporan->kategori_laporan;
                if (isset($kategoriCounts[$kat])) {
                    $kategoriCounts[$kat]++;
                }

                // Lokasi (kata pertama)
                $lokasiKey = trim(explode(',', $laporan->lokasi)[0]);
                $lokasiCounts[$lokasiKey] = ($lokasiCounts[$lokasiKey] ?? 0) + 1;

                // Per bulan masuk
                $bln = \Carbon\Carbon::parse($laporan->tanggal_buat)->format('Y-m');
                $bulanCounts[$bln] = ($bulanCounts[$bln] ?? 0) + 1;

                // Per bulan selesai + resolusi
                if ($bucket === 'Selesai' && $laporan->tanggal_rubah) {
                    $bulanSelesaiCount[$bln] = ($bulanSelesaiCount[$bln] ?? 0) + 1;

                    $jamResolusi = \Carbon\Carbon::parse($laporan->tanggal_buat)
                        ->diffInMinutes(\Carbon\Carbon::parse($laporan->tanggal_rubah)) / 60;
                    $resolusiJam[] = $jamResolusi;

                    if ($jamResolusi <= $SLA_TARGET_JAM) {
                        $selesaiDalamSLA++;
                    }
                } elseif ($bucket === 'Selesai') {
                    $bulanSelesaiCount[$bln] = ($bulanSelesaiCount[$bln] ?? 0) + 1;
                }
            }

            // Urutkan bulan
            ksort($bulanCounts);

            // Bangun set bulan gabungan (masuk + selesai)
            $allBulan = array_unique(array_merge(array_keys($bulanCounts), array_keys($bulanSelesaiCount)));
            sort($allBulan);

            $bulanFormatted = [];
            foreach ($allBulan as $key) {
                $bulanFormatted[] = [
                    'bulan'    => \Carbon\Carbon::createFromFormat('Y-m', $key)->locale('id')->isoFormat('MMM YYYY'),
                    'bulan_en' => \Carbon\Carbon::createFromFormat('Y-m', $key)->format('M'),
                    'key'      => $key,
                    'masuk'    => $bulanCounts[$key] ?? 0,
                    'selesai'  => $bulanSelesaiCount[$key] ?? 0,
                ];
            }

            // Urutkan lokasi terbanyak
            arsort($lokasiCounts);
            $topLokasi = array_slice($lokasiCounts, 0, 5, true);
            $lokasiFormatted = [];
            foreach ($topLokasi as $nama => $count) {
                $lokasiFormatted[] = ['nama' => $nama, 'jumlah' => $count];
            }

            $totalLaporan      = $laporans->count();
            $totalSelesai      = $statusCounts['Selesai'];
            $totalAktif        = $statusCounts['Terkirim'] + $statusCounts['Diverifikasi'] + $statusCounts['Diproses'];
            $persentaseSelesai = $totalLaporan > 0 ? round(($totalSelesai / $totalLaporan) * 100, 1) : 0;

            // ── KPI Metrik ────────────────────────────────────────────────────
            $rataResolusiJam = count($resolusiJam) > 0
                ? round(array_sum($resolusiJam) / count($resolusiJam), 1)
                : null;

            $tingkatSLA = $totalSelesai > 0
                ? round(($selesaiDalamSLA / $totalSelesai) * 100, 1)
                : null;

            $kepuasanScore = null;
            if ($totalSelesai > 0) {
                $kepuasanScore = round(1.0 + ($persentaseSelesai / 100) * 4.0, 1);
            }

            // ── Realisasi Anggaran (estimasi biaya berdasarkan kategori) ──────
            // Fasilitas: Rp 500.000/tiket, Kebersihan: Rp 150.000/tiket
            $BIAYA_FASILITAS  = 500000;
            $BIAYA_KEBERSIHAN = 150000;

            // Hitung selesai per kategori
            $selesaiFasilitas  = 0;
            $selesaiKebersihan = 0;
            foreach ($laporans as $laporan) {
                $terkiniCheck = $this->normalizeBucketStatus(
                    $laporan->statuses->first()?->status_laporan ?? 'Terkirim'
                );
                if ($terkiniCheck === 'Selesai') {
                    if ($laporan->kategori_laporan === 'Fasilitas') {
                        $selesaiFasilitas++;
                    } elseif ($laporan->kategori_laporan === 'Kebersihan') {
                        $selesaiKebersihan++;
                    }
                }
            }

            $realisasiAnggaran = ($selesaiFasilitas * $BIAYA_FASILITAS) + ($selesaiKebersihan * $BIAYA_KEBERSIHAN);
            // Budget target: 10 juta per bulan / per periode (bisa disesuaikan)
            $budgetTarget = 10000000;
            $pctAnggaran  = $budgetTarget > 0 ? round(($realisasiAnggaran / $budgetTarget) * 100, 1) : 0;

            // Dominasi lokasi (lokasi terbanyak)
            $dominasiLokasi = count($lokasiFormatted) > 0 ? $lokasiFormatted[0]['nama'] : null;

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'total_laporan'      => $totalLaporan,
                    'total_selesai'      => $totalSelesai,
                    'total_aktif'        => $totalAktif,
                    'total_ditolak'      => $statusCounts['Ditolak'],
                    'persentase_selesai' => $persentaseSelesai,
                    // KPI
                    'rata_resolusi_jam'  => $rataResolusiJam,
                    'tingkat_sla'        => $tingkatSLA,
                    'sla_target_jam'     => $SLA_TARGET_JAM,
                    'selesai_dalam_sla'  => $selesaiDalamSLA,
                    'kepuasan_score'     => $kepuasanScore,
                    // Realisasi Anggaran
                    'realisasi_anggaran' => $realisasiAnggaran,
                    'budget_target'      => $budgetTarget,
                    'pct_anggaran'       => $pctAnggaran,
                    // Distribusi
                    'per_status'         => $statusCounts,
                    'per_kategori'       => $kategoriCounts,
                    'per_bulan'          => $bulanFormatted,
                    'top_lokasi'         => $lokasiFormatted,
                    'dominasi_lokasi'    => $dominasiLokasi,
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil data rekap: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PATCH /api/admin/laporan/{id}/status
     * Admin: Ubah status laporan dan simpan pesan tanggapan
     */
    public function adminUpdateStatus(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status_laporan' => [
                'required',
                'string',
                'in:Terkirim,Sedang Diverifikasi,Terverifikasi,Proses,Selesai,Ditolak'
            ],
            'pesan_tanggapan' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

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
     * Normalisasi semua varian nama status ke bucket rekap:
     * - Terkirim
     * - Diverifikasi  (mencakup: Sedang Diverifikasi, Terverifikasi, Diverifikasi)
     * - Diproses      (mencakup: Proses, Diproses)
     * - Selesai
     * - Ditolak
     */
    private function normalizeBucketStatus(string $status): string
    {
        $s = strtolower(trim($status));

        if ($s === 'terkirim') return 'Terkirim';
        if (in_array($s, ['sedang diverifikasi', 'diverifikasi', 'terverifikasi'])) return 'Diverifikasi';
        if (in_array($s, ['proses', 'diproses'])) return 'Diproses';
        if ($s === 'selesai') return 'Selesai';
        if ($s === 'ditolak') return 'Ditolak';

        return 'Terkirim'; // fallback
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
