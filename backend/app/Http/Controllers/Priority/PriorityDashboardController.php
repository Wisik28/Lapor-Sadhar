<?php

namespace App\Http\Controllers\Priority;

use App\Http\Controllers\Controller;
use App\Models\Laporan;
use App\Models\Priority\PriorityAssessment;
use App\Services\Priority\PriorityScoringService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PriorityDashboardController extends Controller
{
    private PriorityScoringService $scoringService;

    public function __construct(PriorityScoringService $scoringService)
    {
        $this->scoringService = $scoringService;
    }

    /**
     * GET /api/admin/priority/reports
     * Mengambil daftar laporan terurut skor prioritas (hanya untuk admin)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Ambil semua laporan beserta status dan pelapor
            $query = Laporan::with([
                'statuses' => function ($q) {
                    $q->orderBy('tanggal_merubah', 'desc');
                },
                'pelapor.mahasiswa',
            ]);

            $laporans = $query->get();

            // Pastikan setiap laporan memiliki PriorityAssessment secara batch (menghindari N+1 query)
            $assessments = $this->scoringService->assessAndSaveMany($laporans);
            $now = now();

            // Format dan susun data laporan
            $items = $laporans->map(function ($laporan) use ($assessments, $now) {
                $assessment = $assessments->get($laporan->id_laporan);
                $latestStatus = $laporan->statuses->first();
                $statusName = $latestStatus?->status_laporan ?? 'Terkirim';

                $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : $now;
                $diffDays = (int) $createdAt->diffInDays($now);
                $diffHours = (int) $createdAt->diffInHours($now);

                $lamaMenunggu = $diffDays > 0 ? "{$diffDays} hari lalu" : ($diffHours > 0 ? "{$diffHours} jam lalu" : 'Baru saja');

                return [
                    'id_laporan'               => $laporan->id_laporan,
                    'nim'                      => $laporan->nim,
                    'nama_pelapor'             => $laporan->pelapor?->mahasiswa?->nama ?? 'Civitas USD',
                    'kategori_laporan'         => $laporan->kategori_laporan,
                    'deskripsi'                => $laporan->deskripsi,
                    'tanggal_buat'             => $laporan->tanggal_buat,
                    'tanggal_kejadian'         => $laporan->tanggal_kejadian,
                    'lokasi'                   => $laporan->lokasi,
                    'kategori_lokasi'          => $assessment?->kategori_lokasi ?? $laporan->kategori_lokasi ?? 'Tidak Diketahui',
                    'tingkat_keparahan_lokasi' => $assessment?->tingkat_keparahan_lokasi ?? $laporan->tingkat_keparahan ?? 'Sedang',
                    'skala_keparahan_lokasi'   => (int) ($assessment?->skala_keparahan_lokasi ?? $laporan->skala_keparahan ?? 2),
                    'foto'                     => $laporan->foto,
                    'status_terkini'           => $statusName,
                    'lama_menunggu'            => $lamaMenunggu,
                    'lama_menunggu_hari'       => $diffDays,

                    // Prioritas & Penilaian
                    'priority_score'           => $assessment?->priority_score ?? 0,
                    'priority_level'           => $assessment?->priority_level ?? 'sedang',
                    'severity_level'           => $assessment?->severity_level ?? 'sedang',
                    'severity_source'          => $assessment?->severity_source ?? 'ai',
                    'ai_suggested_severity'    => $assessment?->ai_suggested_severity ?? 'sedang',
                    'admin_severity'           => $assessment?->admin_severity,
                    'confidence'               => $assessment?->confidence ?? 0.8,
                    'needs_review'             => $assessment?->needs_review ?? true,
                    'reasons'                  => $assessment?->reasons ?? [],
                    'ringkasan_alasan'         => !empty($assessment?->reasons) ? $assessment->reasons[0] : '-',
                    'safety_flags'             => $assessment?->safety_flags ?? [],
                    'admin_notes'              => $assessment?->admin_notes,
                    'reviewed_at'              => $assessment?->reviewed_at?->toIso8601String(),
                ];
            });

            // Siapkan parameter filter satu kali di luar iterasi (Single-Pass Filtering)
            $katFilter = ($request->filled('kategori') && $request->kategori !== 'Semua')
                ? strtolower($request->kategori)
                : null;
            $sevFilter = ($request->filled('severity') && $request->severity !== 'Semua')
                ? strtolower($request->severity)
                : null;
            $plFilter = ($request->filled('priority_level') && $request->priority_level !== 'Semua')
                ? strtolower($request->priority_level)
                : null;
            $stFilter = ($request->filled('status') && $request->status !== 'Semua')
                ? strtolower($request->status)
                : null;
            $needsReviewFilter = $request->boolean('needs_review');
            $searchQuery = $request->filled('search') ? strtolower($request->search) : null;

            if ($katFilter !== null || $sevFilter !== null || $plFilter !== null || $stFilter !== null || $needsReviewFilter || $searchQuery !== null) {
                $items = $items->filter(function ($it) use ($katFilter, $sevFilter, $plFilter, $stFilter, $needsReviewFilter, $searchQuery) {
                    if ($katFilter !== null && strtolower($it['kategori_laporan']) !== $katFilter) {
                        return false;
                    }
                    if ($sevFilter !== null && strtolower($it['severity_level']) !== $sevFilter) {
                        return false;
                    }
                    if ($plFilter !== null && strtolower($it['priority_level']) !== $plFilter) {
                        return false;
                    }
                    if ($stFilter !== null && strtolower($it['status_terkini']) !== $stFilter) {
                        return false;
                    }
                    if ($needsReviewFilter && $it['needs_review'] !== true) {
                        return false;
                    }
                    if ($searchQuery !== null) {
                        return str_contains(strtolower($it['deskripsi']), $searchQuery)
                            || str_contains(strtolower($it['lokasi']), $searchQuery)
                            || str_contains(strtolower($it['nama_pelapor']), $searchQuery)
                            || str_contains((string) $it['id_laporan'], $searchQuery);
                    }
                    return true;
                });
            }

            // Pengurutan Utama:
            // 1. Bobot Skor Prioritas Menurun (DESC)
            // 2. Tanggal Buat Menaik (laporan lebih lama didahulukan jika skor sama)
            $sortedItems = $items->sort(function ($a, $b) {
                if ($a['priority_score'] === $b['priority_score']) {
                    return strcmp($a['tanggal_buat'], $b['tanggal_buat']);
                }
                return $b['priority_score'] <=> $a['priority_score'];
            })->values();

            return response()->json([
                'status'  => 'success',
                'message' => 'Data dashboard prioritas berhasil dimuat.',
                'total'   => $sortedItems->count(),
                'data'    => $sortedItems,
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil data dashboard prioritas: ' . $e->getMessage(),
                'data'    => [],
            ], 500);
        }
    }

    /**
     * GET /api/admin/priority/reports/{id}
     * Ambil rincian penilaian prioritas sebuah laporan
     */
    public function show($id): JsonResponse
    {
        try {
            $laporan = Laporan::with(['statuses', 'pelapor.mahasiswa'])->findOrFail($id);
            $assessment = $this->scoringService->assessAndSave($laporan);

            $locWeight = $this->scoringService->resolveLocationWeight($laporan->lokasi ?? '');
            $distinctReporters = $this->scoringService->countNearbyReporters($laporan);
            $createdAt = $laporan->tanggal_buat ? Carbon::parse($laporan->tanggal_buat) : now();
            $daysWaiting = (float) max(0, $createdAt->diffInDays(now()));

            $calculation = $this->scoringService->calculateScore(
                $laporan->kategori_laporan,
                $assessment->dimensions ?? [],
                $locWeight,
                $distinctReporters,
                $daysWaiting,
                $assessment->safety_flags ?? []
            );

            $feedback = [];
            try {
                if ($this->scoringService->ensureTablesExist()) {
                    $feedback = $assessment->feedback()->with('admin')->orderBy('created_at', 'desc')->get();
                }
            } catch (\Throwable $e) {
                $feedback = [];
            }

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'laporan'     => $laporan,
                    'assessment'  => $assessment,
                    'breakdown'   => $calculation['breakdown'],
                    'feedback'    => $feedback,
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil detail prioritas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PATCH /api/admin/priority/reports/{id}/severity
     * Admin menetapkan atau menimpa (override) tingkat kerusakan
     */
    public function updateSeverity(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'severity_level' => 'required|string|in:berat,sedang,ringan',
            'admin_notes'    => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $session = $request->attributes->get('admin_session');
            $adminId = $session?->admin_id;

            $updated = $this->scoringService->overrideSeverityByAdmin(
                (int) $id,
                $request->input('severity_level'),
                $request->input('admin_notes'),
                $adminId
            );

            return response()->json([
                'status'  => 'success',
                'message' => 'Tingkat kerusakan dan skor prioritas berhasil diperbarui oleh admin.',
                'data'    => $updated,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memperbarui prioritas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/admin/priority/summary
     * Metrik ringkasan kartu statistik dashboard prioritas
     */
    public function summary(): JsonResponse
    {
        try {
            // Relasi statuses tidak dipakai pada ringkasan, jadi tidak perlu di-eager-load (hemat 1 query).
            $laporans = Laporan::all();

            // Pastikan terdata secara batch (menghindari N+1 query)
            $assessments = $this->scoringService->assessAndSaveMany($laporans);

            $totalActive = 0;
            $countKritis = 0;
            $countTinggi = 0;
            $countSedang = 0;
            $countRendah = 0;
            $countNeedsReview = 0;
            $totalScores = 0;

            foreach ($assessments as $item) {
                if ($item->needs_review) {
                    $countNeedsReview++;
                }

                $totalScores += $item->priority_score;

                if ($item->severity_level === 'berat' || $item->priority_level === 'kritis') {
                    $countKritis++;
                } elseif ($item->priority_level === 'tinggi') {
                    $countTinggi++;
                } elseif ($item->priority_level === 'sedang') {
                    $countSedang++;
                } else {
                    $countRendah++;
                }
            }

            $total = $assessments->count();
            $avgScore = $total > 0 ? round($totalScores / $total, 1) : 0;

            return response()->json([
                'status' => 'success',
                'data'   => [
                    'total_laporan'       => $total,
                    'kritis_berat'        => $countKritis,
                    'tinggi'              => $countTinggi,
                    'sedang'              => $countSedang,
                    'rendah'              => $countRendah,
                    'perlu_konfirmasi'    => $countNeedsReview,
                    'rata_skor_prioritas' => $avgScore,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memuat ringkasan prioritas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/admin/priority/recalculate
     * Menghitung ulang semua laporan aktif (misalnya untuk penuaan / aging harian)
     */
    public function recalculateAll(): JsonResponse
    {
        try {
            $laporans = Laporan::all();
            $assessments = $this->scoringService->assessAndSaveMany($laporans, true);
            $count = $assessments->count();

            return response()->json([
                'status'  => 'success',
                'message' => "Berhasil menghitung ulang prioritas untuk {$count} laporan.",
                'total'   => $count,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menghitung ulang: ' . $e->getMessage(),
            ], 500);
        }
    }
}

