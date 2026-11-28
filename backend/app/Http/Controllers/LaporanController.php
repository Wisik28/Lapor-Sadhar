<?php

namespace App\Http\Controllers;

use App\Models\Laporan;
use App\Services\LaporanService;
use App\Http\Requests\Laporan\StoreLaporanRequest;
use App\Http\Requests\Laporan\UpdateLaporanRequest;
use App\Http\Requests\Laporan\UpdateStatusLaporanRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

/**
 * LaporanController - HTTP Controller untuk fitur Laporan
 * Mengelola HTTP requests/responses dan delegasi ke Service
 */
class LaporanController extends Controller
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 100;

    private LaporanService $laporanService;

    public function __construct(LaporanService $laporanService)
    {
        $this->laporanService = $laporanService;
    }

    private function resolvePerPage(Request $request): int
    {
        $perPage = (int) $request->input('per_page', self::DEFAULT_PER_PAGE);

        return min(self::MAX_PER_PAGE, max(1, $perPage > 0 ? $perPage : self::DEFAULT_PER_PAGE));
    }

    /**
     * Kolom tabel laporan untuk endpoint daftar (opsional menyertakan kolom `foto`).
     *
     * @return array<int, string>
     */
    private function listLaporanColumns(bool $includeFoto = true, bool $includeGrouping = false): array
    {
        $columns = [
            'id_laporan',
            'nim',
            'kategori_laporan',
            'deskripsi',
            'tanggal_kejadian',
            'tanggal_buat',
            'tanggal_rubah',
            'lokasi_kampus',
            'lokasi',
            'kategori_lokasi',
            'tingkat_keparahan',
            'skala_keparahan',
            'pesan_tanggapan',
        ];

        if ($includeGrouping) {
            $columns[] = 'group_id';
        }

        if ($includeFoto) {
            $columns[] = 'foto';
        }

        return $columns;
    }

    private function buildUserLaporanEtag(
        string $identifier,
        bool $hasPage,
        int $page,
        int $perPage,
        bool $includeFoto
    ): string {
        $laporanStats = DB::table('laporan')
            ->where('nim', $identifier)
            ->selectRaw('COUNT(*) AS total, MAX(id_laporan) AS max_id, MAX(updated_at) AS max_updated, MAX(tanggal_rubah) AS max_rubah')
            ->first();

        $statusStats = DB::table('status')
            ->join('laporan', 'laporan.id_laporan', '=', 'status.id_laporan')
            ->where('laporan.nim', $identifier)
            ->selectRaw('COUNT(*) AS total, MAX(status.id_status) AS max_status_id, MAX(status.tanggal_merubah) AS max_status_date')
            ->first();

        $fingerprint = implode('|', [
            $identifier,
            $hasPage ? "p{$page}:{$perPage}" : 'all',
            $includeFoto ? 'f1' : 'f0',
            (string) ($laporanStats->total ?? 0),
            (string) ($laporanStats->max_id ?? ''),
            (string) ($laporanStats->max_updated ?? ''),
            (string) ($laporanStats->max_rubah ?? ''),
            (string) ($statusStats->total ?? 0),
            (string) ($statusStats->max_status_id ?? ''),
            (string) ($statusStats->max_status_date ?? ''),
        ]);

        return '"' . sha1($fingerprint) . '"';
    }

    private function ifNoneMatchMatches(?string $header, string $etag): bool
    {
        if (! $header) {
            return false;
        }

        $normalizedTarget = ltrim(trim($etag), 'W/');
        foreach (explode(',', $header) as $candidate) {
            $trimmed = trim($candidate);
            if ($trimmed === '*' || ltrim($trimmed, 'W/') === $normalizedTarget) {
                return true;
            }
        }

        return false;
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
    public function index(Request $request): HttpResponse|JsonResponse
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

            $includeFoto = $request->has('include_foto') ? $request->boolean('include_foto') : true;
            $perPage = $this->resolvePerPage($request);
            $page = max(1, (int) $request->input('page', 1));
            $hasPage = $request->has('page');

            $etag = $this->buildUserLaporanEtag($identifier, $hasPage, $page, $perPage, $includeFoto);
            if ($this->ifNoneMatchMatches($request->header('If-None-Match'), $etag)) {
                return response('', 304)
                    ->header('ETag', $etag)
                    ->header('Cache-Control', 'private, no-cache');
            }

            // Ambil laporan berdasarkan identitas pengguna dengan kolom selektif
            $query = Laporan::query()
                ->select($this->listLaporanColumns($includeFoto))
                ->with([
                    'statuses' => function ($query) {
                        $query->select(['id_status', 'id_laporan', 'status_laporan', 'tanggal_merubah']);
                        $query->orderBy('tanggal_merubah', 'desc');
                        $query->orderBy('id_status', 'desc');
                    }
                ])
                ->where('nim', $identifier)
                ->orderBy('tanggal_buat', 'desc');

            $total = (clone $query)->count();
            $lastPage = (int) max(1, ceil($total / $perPage));

            if ($hasPage) {
                $rawLaporans = $query->forPage($page, $perPage)->get();
            } else {
                $rawLaporans = $query->get();
            }

            $laporans = $rawLaporans->map(function ($laporan) use ($includeFoto) {
                $latestStatus = $laporan->statuses->first();

                return [
                    'id_laporan'        => $laporan->id_laporan,
                    'nim'               => $laporan->nim,
                    'kategori_laporan'  => $laporan->kategori_laporan,
                    'deskripsi'         => $laporan->deskripsi,
                    'tanggal_kejadian'  => $laporan->tanggal_kejadian,
                    'tanggal_buat'      => $laporan->tanggal_buat,
                    'tanggal_rubah'     => $laporan->tanggal_rubah,
                    'lokasi_kampus'     => $laporan->lokasi_kampus,
                    'lokasi'            => $laporan->lokasi,
                    'kategori_lokasi'   => $laporan->kategori_lokasi ?? 'Tidak Diketahui',
                    'tingkat_keparahan' => $laporan->tingkat_keparahan ?? 'Sedang',
                    'skala_keparahan'   => (int) ($laporan->skala_keparahan ?? 2),
                    'foto'              => $includeFoto ? $laporan->foto : null,

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
                'status'       => 'success',
                'message'      => 'Data laporan berhasil dimuat.',
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'data'         => $laporans,
            ], 200)
                ->header('ETag', $etag)
                ->header('Cache-Control', 'private, no-cache');

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
    public function adminIndex(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $includeFoto = $request->has('include_foto') ? $request->boolean('include_foto') : true;
            $hasGroupingSchema = Schema::hasTable('laporan_groups') && Schema::hasColumn('laporan', 'group_id');

            $relations = [
                'statuses' => function ($query) {
                    $query->select(['id_status', 'id_laporan', 'status_laporan', 'tanggal_merubah']);
                    $query->orderBy('tanggal_merubah', 'desc');
                    $query->orderBy('id_status', 'desc');
                },
                'pelapor:nomor_identitas,tipe_user',
                'pelapor.mahasiswa:nim,nama',
                'pelapor.pegawai:nomor_identitas,nama',
            ];

            if ($hasGroupingSchema) {
                $relations[] = 'group:id,primary_laporan_id,total_laporan_count,unique_reporter_count,is_escalated';
            }

            $query = Laporan::query()
                ->select($this->listLaporanColumns($includeFoto, $hasGroupingSchema))
                ->with($relations)
                ->visibleToAdmin($admin)
                ->orderBy('tanggal_buat', 'desc');

            $total = (clone $query)->count();
            $perPage = $this->resolvePerPage($request);
            $page = max(1, (int) $request->input('page', 1));
            $lastPage = (int) max(1, ceil($total / $perPage));

            if ($request->has('page')) {
                $rawLaporans = $query->forPage($page, $perPage)->get();
            } else {
                $rawLaporans = $query->get();
            }

            $laporans = $rawLaporans->map(function ($laporan) use ($includeFoto, $hasGroupingSchema) {
                $statusTerbaru = $laporan->statuses->first();
                $group = $hasGroupingSchema ? $laporan->group : null;

                return [
                    'id_laporan'               => $laporan->id_laporan,
                    'nim'                      => $laporan->nim,
                    'nama_pelapor'             => $laporan->nama_pelapor ?? $laporan->pelapor?->mahasiswa?->nama ?? $laporan->pelapor?->pegawai?->nama ?? '-',
                    'tipe_user'                => $laporan->pelapor?->tipe_user ?? 'Mahasiswa',
                    'kategori_laporan'         => $laporan->kategori_laporan,
                    'deskripsi'                => $laporan->deskripsi,
                    'tanggal_kejadian'         => $laporan->tanggal_kejadian,
                    'tanggal_buat'             => $laporan->tanggal_buat,
                    'tanggal_rubah'            => $laporan->tanggal_rubah,
                    'lokasi_kampus'            => $laporan->lokasi_kampus,
                    'lokasi'                   => $laporan->lokasi,
                    'kategori_lokasi'          => $laporan->kategori_lokasi ?? 'Tidak Diketahui',
                    'tingkat_keparahan'        => $laporan->tingkat_keparahan ?? 'Sedang',
                    'skala_keparahan'          => (int) ($laporan->skala_keparahan ?? 2),
                    'foto'                     => $includeFoto ? $laporan->foto : null,
                    'pesan_tanggapan'          => $laporan->pesan_tanggapan ?? '',
                    'status_terkini'           => $statusTerbaru?->status_laporan ?? 'Terkirim',
                    'riwayat_status'           => $laporan->statuses,
                    'group_id'                 => $hasGroupingSchema && $laporan->group_id ? (int) $laporan->group_id : null,
                    'group_member_count'       => $group ? (int) $group->total_laporan_count : 1,
                    'group_unique_reporters'   => $group ? (int) $group->unique_reporter_count : 1,
                    'group_primary_laporan_id' => $group?->primary_laporan_id ? (int) $group->primary_laporan_id : null,
                    'is_group_escalated'       => (bool) ($group?->is_escalated ?? false),
                ];
            });

            return response()->json([
                'status'       => 'success',
                'message'      => 'Data laporan admin berhasil dimuat.',
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'data'         => $laporans,
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
     * GET /api/admin/laporan/seen
     * Admin: Ambil daftar ID laporan yang sudah pernah dibaca oleh admin saat ini
     */
    public function adminSeenIndex(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            if (! $admin) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Sesi admin tidak valid.',
                ], 401);
            }

            $seenIds = DB::table('admin_report_reads')
                ->where('admin_id', $admin->admin_id)
                ->orderByDesc('read_at')
                ->pluck('id_laporan')
                ->map(fn ($id) => (int) $id)
                ->values();

            return response()->json([
                'status' => 'success',
                'data'   => $seenIds,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memuat status baca laporan.',
            ], 500);
        }
    }

    /**
     * POST /api/admin/laporan/{id}/seen
     * Admin: Tandai laporan sebagai sudah dibaca oleh admin saat ini (lintas perangkat)
     */
    public function adminMarkSeen(Request $request, $id): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            if (! $admin) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Sesi admin tidak valid.',
                ], 401);
            }

            $laporan = Laporan::query()
                ->select(['id_laporan', 'lokasi_kampus', 'kategori_laporan'])
                ->findOrFail($id);

            if (! $admin->canAccessLaporan($laporan)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Anda tidak memiliki akses ke laporan dari kampus atau unit lain.',
                ], 403);
            }

            $now = now();
            DB::table('admin_report_reads')->upsert(
                [
                    [
                        'admin_id'   => $admin->admin_id,
                        'id_laporan' => $laporan->id_laporan,
                        'read_at'    => $now,
                    ],
                ],
                ['admin_id', 'id_laporan'],
                ['read_at']
            );

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'id_laporan' => (int) $laporan->id_laporan,
                    'read_at'    => $now->toIso8601String(),
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyimpan status baca laporan.',
            ], 500);
        }
    }

    /**
     * GET /api/admin/rekap
     * Admin: Rekap & Analitik Laporan untuk Admin (kolom ringan tanpa foto + 5 laporan terbaru)
     */
    public function adminRekap(Request $request): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $bulan = $request->query('bulan'); // format: "2026-10"
            $tahun = $request->query('tahun'); // format: "2026"

            // Tarik hanya kolom ringan yang diperlukan untuk agregasi + status terbaru via subquery terindeks
            // (tidak menarik kolom longText `foto`, `deskripsi`, `pesan_tanggapan`, maupun seluruh riwayat status).
            $query = Laporan::query()
                ->select([
                    'laporan.id_laporan',
                    'laporan.kategori_laporan',
                    'laporan.lokasi',
                    'laporan.tanggal_buat',
                    'laporan.tanggal_rubah',
                    DB::raw('(SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1) AS latest_status'),
                ])
                ->visibleToAdmin($admin);

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

            // ── Kalkulasi per laporan (Single-Pass Aggregation) ───────────────
            $resolusiJam       = [];
            $SLA_TARGET_JAM    = 24; // target SLA: 24 jam
            $selesaiDalamSLA   = 0;
            $selesaiFasilitas  = 0;
            $selesaiKebersihan = 0;

            foreach ($laporans as $laporan) {
                // Status terkini — normalisasi semua varian nama status ke bucket rekap
                $terkini = $laporan->latest_status ?? 'Terkirim';
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

                // Per bulan masuk (ekstraksi cepat YYYY-MM tanpa alokasi Carbon berulang)
                $rawBuat = (string) $laporan->tanggal_buat;
                $bln = (strlen($rawBuat) >= 7 && $rawBuat[4] === '-')
                    ? substr($rawBuat, 0, 7)
                    : \Carbon\Carbon::parse($laporan->tanggal_buat)->format('Y-m');
                $bulanCounts[$bln] = ($bulanCounts[$bln] ?? 0) + 1;

                // Per bulan selesai + resolusi + perhitungan kategori selesai dalam satu iterasi
                if ($bucket === 'Selesai') {
                    $bulanSelesaiCount[$bln] = ($bulanSelesaiCount[$bln] ?? 0) + 1;

                    if ($kat === 'Fasilitas') {
                        $selesaiFasilitas++;
                    } elseif ($kat === 'Kebersihan') {
                        $selesaiKebersihan++;
                    }

                    if ($laporan->tanggal_rubah) {
                        $jamResolusi = \Carbon\Carbon::parse($laporan->tanggal_buat)
                            ->diffInMinutes(\Carbon\Carbon::parse($laporan->tanggal_rubah)) / 60;
                        $resolusiJam[] = $jamResolusi;

                        if ($jamResolusi <= $SLA_TARGET_JAM) {
                            $selesaiDalamSLA++;
                        }
                    }
                }
            }

            // Urutkan bulan
            ksort($bulanCounts);

            // Bangun set bulan gabungan (masuk + selesai)
            $allBulan = array_unique(array_merge(array_keys($bulanCounts), array_keys($bulanSelesaiCount)));
            sort($allBulan);

            $bulanFormatted = [];
            foreach ($allBulan as $key) {
                $dt = \Carbon\Carbon::createFromFormat('Y-m', $key);
                $bulanFormatted[] = [
                    'bulan'    => (clone $dt)->locale('id')->isoFormat('MMM YYYY'),
                    'bulan_en' => $dt->format('M'),
                    'key'      => $key,
                    'masuk'    => $bulanCounts[$key] ?? 0,
                    'selesai'  => $bulanSelesaiCount[$key] ?? 0,
                ];
            }

            // Urutkan lokasi terbanyak
            arsort($lokasiCounts);
            $lokasiFormatted = [];
            foreach ($lokasiCounts as $nama => $count) {
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

            $realisasiAnggaran = ($selesaiFasilitas * $BIAYA_FASILITAS) + ($selesaiKebersihan * $BIAYA_KEBERSIHAN);
            // Budget target: 10 juta per bulan / per periode (bisa disesuaikan)
            $budgetTarget = 10000000;
            $pctAnggaran  = $budgetTarget > 0 ? round(($realisasiAnggaran / $budgetTarget) * 100, 1) : 0;

            // Dominasi lokasi (lokasi terbanyak)
            $dominasiLokasi = count($lokasiFormatted) > 0 ? $lokasiFormatted[0]['nama'] : null;

            // Laporan rekap dalam cakupan admin (default 5, atau sesuai limit_terbaru)
            $limitTerbaru = $request->has('limit_terbaru')
                ? max(1, min(100, (int) $request->query('limit_terbaru')))
                : 5;

            $laporanTerbaruQuery = Laporan::query()
                ->select([
                    'laporan.id_laporan',
                    'laporan.nim',
                    'laporan.kategori_laporan',
                    'laporan.deskripsi',
                    'laporan.tanggal_kejadian',
                    'laporan.tanggal_buat',
                    'laporan.lokasi_kampus',
                    'laporan.lokasi',
                    DB::raw('(SELECT s.status_laporan FROM status s WHERE s.id_laporan = laporan.id_laporan ORDER BY s.tanggal_merubah DESC, s.id_status DESC LIMIT 1) AS latest_status'),
                ])
                ->visibleToAdmin($admin);

            if ($bulan) {
                $laporanTerbaruQuery->whereRaw("TO_CHAR(tanggal_buat, 'YYYY-MM') = ?", [$bulan]);
            } elseif ($tahun) {
                $laporanTerbaruQuery->whereRaw("TO_CHAR(tanggal_buat, 'YYYY') = ?", [$tahun]);
            }

            $laporanTerbaru = $laporanTerbaruQuery
                ->orderBy('laporan.tanggal_buat', 'desc')
                ->limit($limitTerbaru)
                ->get()
                ->map(fn ($item) => [
                    'id_laporan'       => $item->id_laporan,
                    'nim'              => $item->nim,
                    'kategori_laporan' => $item->kategori_laporan,
                    'deskripsi'        => $item->deskripsi,
                    'tanggal_kejadian' => $item->tanggal_kejadian,
                    'tanggal_buat'     => $item->tanggal_buat,
                    'lokasi_kampus'    => $item->lokasi_kampus,
                    'lokasi'           => $item->lokasi,
                    'status_terkini'   => $item->latest_status ?? 'Terkirim',
                ])
                ->values();

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
                    'laporan_terbaru'    => $laporanTerbaru,
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
            $admin = $request->attributes->get('admin_session')?->admin;
            $laporan = Laporan::findOrFail($id);

            if ($admin && ! $admin->canEditLaporan($laporan)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Anda tidak memiliki wewenang untuk mengubah status laporan ini.',
                ], 403);
            }

            $hasil = $this->laporanService->updateStatusLaporan(
                $id,
                $request->input('status_laporan'),
                $request->input('pesan_tanggapan') ?? ''
            );

            $syncedCount = (int) ($hasil['synced_count'] ?? 1);
            $message = $syncedCount > 1
                ? "Status laporan berhasil diperbarui dan disinkronkan ke {$syncedCount} laporan serupa dalam grup."
                : 'Status laporan berhasil diperbarui.';

            return response()->json([
                'status'  => 'success',
                'message' => $message,
                'data'    => $hasil,
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
     * PATCH /api/admin/laporan/{id}/kategori
     * Admin BPS/BLU: Memindahkan laporan yang salah kategori ke unit lain (BPS <-> BLU)
     */
    public function adminTransferKategori(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'kategori_laporan'   => 'required|string|in:Fasilitas,Kebersihan',
            'catatan_pemindahan' => 'nullable|string|max:500',
        ], [
            'kategori_laporan.required' => 'Kategori tujuan wajib dipilih.',
            'kategori_laporan.in'       => 'Kategori tujuan harus Fasilitas (BPS) atau Kebersihan (BLU).',
            'catatan_pemindahan.max'    => 'Catatan pemindahan maksimal 500 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $laporan = Laporan::findOrFail($id);

            if (! $admin || ! in_array($admin->role, ['BPS', 'BLU'], true) || ! $admin->canEditLaporan($laporan)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Anda tidak memiliki wewenang untuk memindahkan kategori laporan ini.',
                ], 403);
            }

            $hasil = $this->laporanService->transferKategoriLaporan(
                (int) $id,
                (string) $request->input('kategori_laporan'),
                $admin,
                $request->input('catatan_pemindahan')
            );

            $formattedId = str_pad((string) $hasil['id_laporan'], 3, '0', STR_PAD_LEFT);

            return response()->json([
                'status'  => 'success',
                'message' => "Laporan #{$formattedId} berhasil dipindahkan ke admin {$hasil['unit_tujuan']} ({$hasil['kategori_laporan']}).",
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
     * DELETE /api/admin/laporan/{id}
     * Admin: Hapus laporan yang berstatus Ditolak sesuai cakupan kampus & unit admin
     */
    public function adminDestroy(Request $request, $id): JsonResponse
    {
        try {
            $admin = $request->attributes->get('admin_session')?->admin;
            $laporan = Laporan::findOrFail($id);

            if (! $admin || ! $admin->canEditLaporan($laporan)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Anda tidak memiliki wewenang untuk menghapus laporan ini.',
                ], 403);
            }

            $this->laporanService->deleteRejectedLaporanByAdmin((int) $id);

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan berstatus Ditolak berhasil dihapus.',
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
        if ($e instanceof \InvalidArgumentException) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }

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
