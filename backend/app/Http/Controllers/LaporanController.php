<?php

namespace App\Http\Controllers;

use App\Models\Laporan;
use App\Models\Status;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LaporanController extends Controller
{
    /**
     * Buat Laporan Baru
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nim'              => 'required|string|exists:pelapor,nomor_identitas',
            'kategori_laporan' => 'required|string|in:Fasilitas,Kebersihan',
            'deskripsi'        => 'required|string|min:10',
            'tanggal_kejadian' => 'required|date|before_or_equal:today',
            'lokasi'           => 'required|string|max:255',
            'foto'             => 'nullable|string',
        ], [
            'nim.required'              => 'NIM pelapor wajib diisi.',
            'nim.exists'                => 'Identitas pelapor tidak ditemukan di sistem.',
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
            }, 'pelapor.mahasiswa', 'pelapor.pegawai'])->findOrFail($id);

            $latestStatus = $laporan->statuses->first();

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'id_laporan'       => $laporan->id_laporan,
                    'nim'              => $laporan->nim,
                    'nama_pelapor'     => $laporan->pelapor?->mahasiswa?->nama ?? $laporan->pelapor?->pegawai?->nama,
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
/**
 * Mengambil seluruh laporan untuk halaman admin.
 */
public function adminIndex()
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
                    'lokasi'            => $laporan->lokasi,
                    'foto'              => $laporan->foto,
                    'pesan_tanggapan'   => $laporan->pesan_tanggapan ?? '',
                    'status_terkini'    => $statusTerbaru?->status_laporan ?? 'Terkirim',
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
 * Rekap & Analitik Laporan untuk Admin (seluruh data)
 */
public function adminRekap(Request $request)
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

        $lokasiCounts      = [];
        $bulanCounts       = [];
        $bulanSelesaiCount = []; // untuk chart 2-seri

        // ── Kalkulasi per laporan ─────────────────────────────────────────
        $resolusiJam      = [];
        $SLA_TARGET_JAM   = 24; // target SLA: 24 jam
        $selesaiDalamSLA  = 0;

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

            // Lokasi (kata pertama)
            $lokasiKey = trim(explode(',', $laporan->lokasi)[0]);
            $lokasiCounts[$lokasiKey] = ($lokasiCounts[$lokasiKey] ?? 0) + 1;

            // Per bulan masuk
            $bln = \Carbon\Carbon::parse($laporan->tanggal_buat)->format('Y-m');
            $bulanCounts[$bln] = ($bulanCounts[$bln] ?? 0) + 1;

            // Per bulan selesai + resolusi
            if ($terkini === 'Selesai' && $laporan->tanggal_rubah) {
                $bulanSelesaiCount[$bln] = ($bulanSelesaiCount[$bln] ?? 0) + 1;

                $jamResolusi = \Carbon\Carbon::parse($laporan->tanggal_buat)
                    ->diffInMinutes(\Carbon\Carbon::parse($laporan->tanggal_rubah)) / 60;
                $resolusiJam[] = $jamResolusi;

                if ($jamResolusi <= $SLA_TARGET_JAM) {
                    $selesaiDalamSLA++;
                }
            } elseif ($terkini === 'Selesai') {
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
            $terkiniCheck = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';
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
        $budgetTarget      = 10000000;
        $pctAnggaran       = $budgetTarget > 0 ? round(($realisasiAnggaran / $budgetTarget) * 100, 1) : 0;

        // Dominasi lokasi (lokasi terbanyak)
        $dominasiLokasi = count($lokasiFormatted) > 0 ? $lokasiFormatted[0]['nama'] : null;

        return response()->json([
            'status' => 'success',
            'data'   => [
                'total_laporan'        => $totalLaporan,
                'total_selesai'        => $totalSelesai,
                'total_aktif'          => $totalAktif,
                'total_ditolak'        => $statusCounts['Ditolak'],
                'persentase_selesai'   => $persentaseSelesai,
                // KPI
                'rata_resolusi_jam'    => $rataResolusiJam,
                'tingkat_sla'          => $tingkatSLA,
                'sla_target_jam'       => $SLA_TARGET_JAM,
                'selesai_dalam_sla'    => $selesaiDalamSLA,
                'kepuasan_score'       => $kepuasanScore,
                // Realisasi Anggaran
                'realisasi_anggaran'   => $realisasiAnggaran,
                'budget_target'        => $budgetTarget,
                'pct_anggaran'         => $pctAnggaran,
                // Distribusi
                'per_status'           => $statusCounts,
                'per_kategori'         => $kategoriCounts,
                'per_bulan'            => $bulanFormatted,
                'top_lokasi'           => $lokasiFormatted,
                'dominasi_lokasi'      => $dominasiLokasi,
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
     * Mengubah status laporan dan menyimpan tanggapan admin.
     */
    public function adminUpdateStatus(Request $request, $id)
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
            $hasil = DB::transaction(function () use ($request, $id) {
                $laporan = Laporan::findOrFail($id);

                $status = Status::create([
                    'id_laporan'      => $laporan->id_laporan,
                    'status_laporan'  => $request->input('status_laporan'),
                    'tanggal_merubah' => now(),
                ]);

                $laporan->pesan_tanggapan = $request->input('pesan_tanggapan', '');
                $laporan->tanggal_rubah = now();
                $laporan->save();

                return [
                    'laporan' => $laporan->fresh(),
                    'status'  => $status,
                ];
            });

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
            return $this->handleDbError($e);
        }
    }

}
