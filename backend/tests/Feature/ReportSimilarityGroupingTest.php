<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\Laporan;
use App\Models\LaporanGroup;
use App\Models\Pelapor;
use App\Models\Priority\PriorityAssessment;
use App\Models\Status;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use App\Services\LaporanService;
use Database\Seeders\AdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReportSimilarityGroupingTest extends TestCase
{
    use RefreshDatabase;

    private const SAMPLE_PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    private function createMahasiswaWithToken(string $nim, string $nama): string
    {
        Pelapor::create([
            'nomor_identitas' => $nim,
            'tipe_user'       => 'mahasiswa',
        ]);

        UserMahasiswa::create([
            'nim'          => $nim,
            'nama'         => $nama,
            'password'     => bcrypt('secret123'),
            'no_handphone' => '081234567890',
        ]);

        $token = "token-user-{$nim}";
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id'   => $nim,
            'token_hash'   => hash('sha256', $token),
            'expires_at'   => now()->addHour(),
        ]);

        return $token;
    }

    private function createAdminToken(string $jabatan): string
    {
        $admin = Admin::where('jabatan', $jabatan)->firstOrFail();
        $token = "token-admin-{$jabatan}-" . uniqid();

        AdminSession::create([
            'admin_id'   => $admin->admin_id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHour(),
        ]);

        return $token;
    }

    private function enableGeminiConfig(float $threshold = 0.75): void
    {
        config()->set('services.gemini.api_key', 'test-fake-gemini-key');
        config()->set('services.gemini.model', 'gemini-2.5-flash');
        config()->set('services.gemini.base_url', 'https://generativelanguage.googleapis.com/v1beta');
        config()->set('services.gemini.similarity_enabled', true);
        config()->set('services.gemini.similarity_threshold', $threshold);
    }

    private function fakeGeminiJsonResponse(bool $isSimilar, float $confidence, string $reason): array
    {
        return [
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'is_similar' => $isSimilar,
                                    'confidence' => $confidence,
                                    'reason'     => $reason,
                                ], JSON_THROW_ON_ERROR),
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_stage_one_prefilter_skips_ai_call_when_no_matching_active_candidate_exists(): void
    {
        $this->enableGeminiConfig();
        Http::fake();

        $this->createMahasiswaWithToken('235314101', 'Pelapor Satu');
        $this->createMahasiswaWithToken('235314102', 'Pelapor Dua');

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        // 1. Laporan selesai di ruangan sama (tidak boleh jadi kandidat)
        $selesai = $service->createLaporan([
            'nim'              => '235314101',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin ruang 204 mati total',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);
        Status::create([
            'id_laporan'      => $selesai->id_laporan,
            'status_laporan'  => 'Selesai',
            'tanggal_merubah' => now()->addMinute(),
        ]);

        // 2. Laporan ditolak di ruangan sama (tidak boleh jadi kandidat)
        $ditolak = $service->createLaporan([
            'nim'              => '235314101',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin ruang 204 rusak parah',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);
        Status::create([
            'id_laporan'      => $ditolak->id_laporan,
            'status_laporan'  => 'Ditolak',
            'tanggal_merubah' => now()->addMinutes(2),
        ]);

        // 3. Laporan aktif beda kategori di ruangan sama
        $service->createLaporan([
            'nim'              => '235314101',
            'kategori_laporan' => 'Kebersihan',
            'deskripsi'        => 'Sampah menumpuk di pojok kelas 204',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);

        // 4. Laporan aktif beda kampus
        $service->createLaporan([
            'nim'              => '235314101',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin ruang 204 mati',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang Kelas 204',
        ]);

        // 5. Laporan aktif beda nomor ruangan (205 vs 204)
        $service->createLaporan([
            'nim'              => '235314101',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin ruang 205 mati',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 205',
        ]);

        // Laporan baru dari pelapor berbeda di Ruang Kelas 204 Kampus 3 kategori Fasilitas -> tidak ada kandidat aktif yang cocok
        $freshReport = $service->createLaporan([
            'nim'              => '235314102',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin gantung kelas 204 tidak menyala',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);

        // Pelapor yang sama mengirim lagi -> kandidat dengan nim yang sama tidak memicu AI
        $sameReporterReport = $service->createLaporan([
            'nim'              => '235314102',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kipas angin gantung kelas 204 masih rusak',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);

        $this->assertNull($freshReport->group_id);
        $this->assertNull($sameReporterReport->group_id);
        $this->assertDatabaseCount('laporan_groups', 0);

        // Tahap 1 tanpa kandidat -> 0 pemanggilan HTTP ke Gemini
        Http::assertNothingSent();
    }

    public function test_hybrid_grouping_deduplicates_group_representatives_escalates_at_three_unique_reporters_and_renders_grouped_dashboard(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $bps3Token = $this->createAdminToken('kepala_bagian_bps_3');

        $this->enableGeminiConfig(0.75);

        $geminiCallCount = 0;
        $capturedRequests = [];
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => function (\Illuminate\Http\Client\Request $request) use (&$geminiCallCount, &$capturedRequests) {
                $geminiCallCount++;
                $capturedRequests[] = $request;

                return Http::response(
                    $this->fakeGeminiJsonResponse(
                        true,
                        0.91,
                        'Kedua laporan merujuk pada kipas angin rusak yang sama di Ruang Kelas 204.'
                    ),
                    200
                );
            },
            'https://res.cloudinary.com/*' => Http::response(
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
                200,
                ['Content-Type' => 'image/png']
            ),
        ]);

        $this->createMahasiswaWithToken('235314201', 'Andi Pratama');
        $this->createMahasiswaWithToken('235314202', 'Budi Santoso');
        $this->createMahasiswaWithToken('235314203', 'Citra Dewi');
        $this->createMahasiswaWithToken('235314204', 'Dimas Wijaya');
        $this->createMahasiswaWithToken('235314205', 'Eka Putri');

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        // Buat 1 laporan lain yang cukup tinggi prioritasnya (bukan bagian grup) untuk memastikan grup tereskalasi naik ke posisi paling atas
        $otherReport = $service->createLaporan([
            'nim'              => '235314205',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'AC ruangan laboratorium tidak dingin dan berisik',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Laboratorium Jaringan 1',
        ]);

        // Laporan A (Pelapor 1) - ringan/minor sehingga tanpa eskalasi skor tidak 100
        $laporanA = $service->createLaporan([
            'nim'              => '235314201',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Cat dinding belakang kelas sedikit terkelupas dekat jendela',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
            'foto'             => 'https://res.cloudinary.com/demo/image/upload/v1/foto_a.jpg',
        ]);
        $this->assertSame(0, $geminiCallCount);

        // Laporan B (Pelapor 2) -> 1 panggilan Gemini -> tergabung dalam grup, belum eskalasi (2 pelapor unik)
        $laporanB = $service->createLaporan([
            'nim'              => '235314202',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Dinding belakang ruang 204 catnya mengelupas cukup lebar',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'kampus 3,   ruang kelas 204 ',
            'foto'             => 'https://res.cloudinary.com/demo/image/upload/v1/foto_b.jpg',
        ]);
        $this->assertSame(1, $geminiCallCount);

        // Pastikan panggilan Gemini benar-benar multimodal (mengirim header x-goog-api-key + inline_data gambar kedua laporan)
        $firstReq = $capturedRequests[0];
        $this->assertTrue($firstReq->hasHeader('x-goog-api-key', 'test-fake-gemini-key'));
        $parts = $firstReq->data()['contents'][0]['parts'] ?? [];
        $inlineImages = array_values(array_filter($parts, static fn (array $p): bool => isset($p['inline_data'])));
        $this->assertCount(2, $inlineImages, 'Verifikasi multimodal harus mengirim foto kandidat dan foto laporan baru sebagai inline_data.');

        $laporanA->refresh();
        $laporanB->refresh();
        $this->assertNotNull($laporanA->group_id);
        $this->assertSame($laporanA->group_id, $laporanB->group_id);

        $group = LaporanGroup::findOrFail($laporanA->group_id);
        $this->assertSame($laporanA->id_laporan, $group->primary_laporan_id);
        $this->assertSame(2, $group->total_laporan_count);
        $this->assertSame(2, $group->unique_reporter_count);
        $this->assertFalse($group->is_escalated);

        // Pelapor 1 mengirim lagi laporan serupa (total 3 laporan, namun tetap 2 pelapor unik!)
        // Hanya boleh 1 panggilan AI (1 tiket representatif grup, bukan membandingkan dengan A dan B sekaligus)
        $laporanA2 = $service->createLaporan([
            'nim'              => '235314201',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Dinding belakang ruang 204 makin mengelupas',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
        ]);
        $this->assertSame(2, $geminiCallCount, 'Hanya 1 tiket representatif per grup yang boleh dikirim ke AI.');

        $group->refresh();
        $this->assertSame(3, $group->total_laporan_count);
        $this->assertSame(2, $group->unique_reporter_count);
        $this->assertFalse($group->is_escalated, '1 user yang mengirim berulang tetap dihitung 1 pelapor unik.');

        // Laporan C (Pelapor 3 berbeda) -> mencapai 3 pelapor unik -> ESKALASI OTOMATIS seluruh grup!
        $laporanC = $service->createLaporan([
            'nim'              => '235314203',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Cat tembok belakang di kelas 204 terkelupas parah',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
            'foto'             => 'https://res.cloudinary.com/demo/image/upload/v1/foto_c.jpg',
        ]);
        $this->assertSame(3, $geminiCallCount);

        $group->refresh();
        $this->assertTrue($group->is_escalated);
        $this->assertSame(3, $group->unique_reporter_count);
        $this->assertSame(4, $group->total_laporan_count);
        $this->assertNotNull($group->escalated_at);

        // Seluruh laporan dalam grup (A, B, A2, C) dinaikkan ke prioritas tertinggi bersamaan
        foreach ([$laporanA, $laporanB, $laporanA2, $laporanC] as $member) {
            $assessment = PriorityAssessment::where('id_laporan', $member->id_laporan)->firstOrFail();
            $this->assertSame(100, $assessment->priority_score);
            $this->assertSame('kritis', $assessment->priority_level);
            $this->assertSame('berat', $assessment->severity_level);
            $this->assertTrue($assessment->is_group_escalated);
            $this->assertSame(3, $assessment->group_unique_reporters);
        }

        // Laporan D (Pelapor 4 berbeda) -> otomatis masuk grup yang sama dengan prioritas tertinggi juga
        $laporanD = $service->createLaporan([
            'nim'              => '235314204',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Tembok belakang kelas 204 catnya terkelupas dan rontok',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 204',
            'foto'             => 'https://res.cloudinary.com/demo/image/upload/v1/foto_d.jpg',
        ]);
        $this->assertSame(4, $geminiCallCount);

        $assessmentD = PriorityAssessment::where('id_laporan', $laporanD->id_laporan)->firstOrFail();
        $this->assertSame(100, $assessmentD->priority_score);
        $this->assertSame('kritis', $assessmentD->priority_level);
        $this->assertSame('berat', $assessmentD->severity_level);
        $this->assertTrue($assessmentD->is_group_escalated);
        $this->assertSame(4, $assessmentD->group_unique_reporters);

        // Verifikasi Dashboard Prioritas menampilkan 1 baris utama untuk grup (di posisi paling atas) + 1 laporan non-grup
        $listResponse = $this->withToken($bps3Token)
            ->getJson('/api/admin/priority/reports')
            ->assertOk();

        $rows = $listResponse->json('data');
        $this->assertCount(2, $rows, 'Grup 5 laporan harus ditampilkan sebagai 1 baris utama + 1 laporan tunggal.');
        $this->assertSame($laporanA->id_laporan, $rows[0]['id_laporan'], 'Tiket utama paling awal harus mewakili grup di posisi paling atas.');
        $this->assertTrue($rows[0]['is_grouped']);
        $this->assertSame(5, $rows[0]['group_member_count']);
        $this->assertSame(4, $rows[0]['group_unique_reporters']);
        $this->assertTrue($rows[0]['is_group_escalated']);
        $this->assertSame(100, $rows[0]['priority_score']);
        $this->assertEqualsCanonicalizing(
            [$laporanA->id_laporan, $laporanB->id_laporan, $laporanA2->id_laporan, $laporanC->id_laporan, $laporanD->id_laporan],
            $rows[0]['group_member_ids']
        );
        $this->assertSame($otherReport->id_laporan, $rows[1]['id_laporan']);

        // Summary juga tidak double-counting anggota grup
        $this->assertSame(2, $listResponse->json('summary.total_laporan'));
        $this->withToken($bps3Token)
            ->getJson('/api/admin/priority/summary')
            ->assertOk()
            ->assertJsonPath('data.total_laporan', 2);

        // Detail tiket memuat seluruh anggota grup beserta nama pelapor, waktu, deskripsi, dan foto masing-masing
        $detailResponse = $this->withToken($bps3Token)
            ->getJson("/api/admin/priority/reports/{$laporanA->id_laporan}")
            ->assertOk();

        $detailGroup = $detailResponse->json('data.group');
        $this->assertNotNull($detailGroup);
        $this->assertSame(5, $detailGroup['total_laporan_count']);
        $this->assertSame(4, $detailGroup['unique_reporter_count']);
        $this->assertTrue($detailGroup['is_escalated']);
        $this->assertCount(5, $detailGroup['members']);
        $this->assertTrue($detailGroup['members'][0]['is_primary']);
        $this->assertSame('Andi Pratama', $detailGroup['members'][0]['nama_pelapor']);
        $this->assertSame('https://res.cloudinary.com/demo/image/upload/v1/foto_a.jpg', $detailGroup['members'][0]['foto']);
        $this->assertSame('Budi Santoso', $detailGroup['members'][1]['nama_pelapor']);
        $this->assertSame('https://res.cloudinary.com/demo/image/upload/v1/foto_b.jpg', $detailGroup['members'][1]['foto']);
    }

    public function test_low_confidence_or_negative_ai_result_keeps_reports_ungrouped(): void
    {
        $this->enableGeminiConfig(0.75);

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::sequence()
                ->push($this->fakeGeminiJsonResponse(true, 0.62, 'Kemiripan kurang meyakinkan.'), 200)
                ->push($this->fakeGeminiJsonResponse(false, 0.94, 'Objek kerusakan berbeda: proyektor vs meja.'), 200),
        ]);

        $this->createMahasiswaWithToken('235314301', 'Pelapor A');
        $this->createMahasiswaWithToken('235314302', 'Pelapor B');
        $this->createMahasiswaWithToken('235314303', 'Pelapor C');

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        $l1 = $service->createLaporan([
            'nim'              => '235314301',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Proyektor kelas mati tidak tampil gambar',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 301',
        ]);

        $l2 = $service->createLaporan([
            'nim'              => '235314302',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Layar proyektor kelas agak buram',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 301',
        ]);

        $l3 = $service->createLaporan([
            'nim'              => '235314303',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Meja dosen patah kakinya di kelas 301',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Kampus III, Ruang Kelas 301',
        ]);

        $this->assertNull($l1->fresh()->group_id);
        $this->assertNull($l2->fresh()->group_id);
        $this->assertNull($l3->fresh()->group_id);
        $this->assertDatabaseCount('laporan_groups', 0);
    }

    public function test_gemini_rate_limit_server_error_and_timeout_fallback_without_failing_report_submission(): void
    {
        $this->enableGeminiConfig();

        $user1Token = $this->createMahasiswaWithToken('235314401', 'Pelapor Fallback 1');
        $user2Token = $this->createMahasiswaWithToken('235314402', 'Pelapor Fallback 2');
        $user3Token = $this->createMahasiswaWithToken('235314403', 'Pelapor Fallback 3');
        $user4Token = $this->createMahasiswaWithToken('235314404', 'Pelapor Fallback 4');

        // Laporan awal tanpa kandidat
        $this->withToken($user1Token)->postJson('/api/laporan', [
            'nim'              => '235314401',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu koridor depan ruang 105 padam sejak pagi',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Ruang 105',
        ])->assertCreated();

        // 1. Rate limit HTTP 429 -> laporan tetap 201 tersimpan tanpa grouping
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'Rate limited']], 429),
        ]);
        $res429 = $this->withToken($user2Token)->postJson('/api/laporan', [
            'nim'              => '235314402',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu depan ruang 105 mati total',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Ruang 105',
        ])->assertCreated();
        $this->assertNull(Laporan::findOrFail($res429->json('data.id_laporan'))->group_id);

        // 2. Server error HTTP 500 -> laporan tetap 201 tersimpan tanpa grouping
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'Internal error']], 500),
        ]);
        $res500 = $this->withToken($user3Token)->postJson('/api/laporan', [
            'nim'              => '235314403',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu ruang 105 masih padam',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Ruang 105',
        ])->assertCreated();
        $this->assertNull(Laporan::findOrFail($res500->json('data.id_laporan'))->group_id);

        // 3. Network timeout (ConnectionException) -> laporan tetap 201 tersimpan tanpa grouping
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => fn () => throw new ConnectionException('Connection timed out'),
        ]);
        $resTimeout = $this->withToken($user4Token)->postJson('/api/laporan', [
            'nim'              => '235314404',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Lampu koridor ruang 105 tidak menyala sama sekali',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Kampus II, Ruang 105',
        ])->assertCreated();
        $this->assertNull(Laporan::findOrFail($resTimeout->json('data.id_laporan'))->group_id);

        $this->assertDatabaseCount('laporan_groups', 0);
        $this->assertDatabaseCount('laporan', 4);
    }

    public function test_status_update_syncs_across_group_enforces_sequential_transitions_and_priority_is_readonly(): void
    {
        $this->app->make(AdminSeeder::class)->run();
        $bps1Token = $this->createAdminToken('kepala_bagian_bps_1');

        $this->enableGeminiConfig(0.75);
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(
                $this->fakeGeminiJsonResponse(true, 0.93, 'Pintu ruang kelas 102 sama-sama rusak di engselnya.'),
                200
            ),
        ]);

        $tokenA = $this->createMahasiswaWithToken('235314501', 'Pelapor Alpha');
        $tokenB = $this->createMahasiswaWithToken('235314502', 'Pelapor Beta');
        $tokenC = $this->createMahasiswaWithToken('235314503', 'Pelapor Gamma');

        /** @var LaporanService $service */
        $service = app(LaporanService::class);

        $lapA = $service->createLaporan([
            'nim'              => '235314501',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Engsel pintu kelas 102 patah sehingga sulit ditutup',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang Kelas 102',
        ]);
        $lapB = $service->createLaporan([
            'nim'              => '235314502',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Pintu ruang 102 engselnya lepas',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang Kelas 102',
        ]);
        $lapC = $service->createLaporan([
            'nim'              => '235314503',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Pintu masuk ruang kelas 102 tidak bisa tertutup rapat',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kampus I, Ruang Kelas 102',
        ]);

        // 1. Aturan bisnis: prioritas bersifat read-only bagi Admin
        $this->withToken($bps1Token)
            ->patchJson("/api/admin/priority/reports/{$lapA->id_laporan}/severity", [
                'severity_level' => 'ringan',
                'admin_notes'    => 'Mencoba menurunkan prioritas manual',
            ])
            ->assertForbidden();

        // 2. Aturan bisnis: tidak boleh melompat langsung dari Terkirim ke Selesai (maupun Proses / Terverifikasi)
        $this->withToken($bps1Token)
            ->patchJson("/api/admin/laporan/{$lapA->id_laporan}/status", [
                'status_laporan'  => 'Selesai',
                'pesan_tanggapan' => 'Mencoba lompat langsung selesai',
            ])
            ->assertUnprocessable();

        $this->withToken($bps1Token)
            ->patchJson("/api/admin/laporan/{$lapA->id_laporan}/status", [
                'status_laporan'  => 'Proses',
                'pesan_tanggapan' => 'Mencoba lompat ke proses',
            ])
            ->assertUnprocessable();

        // Ambil ETag awal pelapor B dan C untuk verifikasi pembaruan real-time di endpoint Lihat Status / Riwayat
        $initialEtagB = $this->withToken($tokenB)->getJson('/api/laporan')->assertOk()->headers->get('ETag');
        $initialEtagC = $this->withToken($tokenC)->getJson('/api/laporan')->assertOk()->headers->get('ETag');

        // 3. Jalankan urutan status yang sah secara bertahap pada tiket utama A -> otomatis tersinkron ke B & C
        $sequence = [
            ['Sedang Diverifikasi', 'Tim BPS sedang memverifikasi engsel pintu 102.'],
            ['Terverifikasi', 'Kerusakan terverifikasi, masuk jadwal perbaikan hari ini.'],
            ['Proses', 'Teknisi sedang mengganti engsel pintu 102.'],
            ['Selesai', 'Engsel pintu kelas 102 sudah selesai diganti dan berfungsi normal.'],
        ];

        foreach ($sequence as [$nextStatus, $note]) {
            $updateRes = $this->withToken($bps1Token)
                ->patchJson("/api/admin/laporan/{$lapA->id_laporan}/status", [
                    'status_laporan'  => $nextStatus,
                    'pesan_tanggapan' => $note,
                ])
                ->assertOk();

            $this->assertSame(3, $updateRes->json('data.synced_count'));
            $this->assertEqualsCanonicalizing(
                [$lapA->id_laporan, $lapB->id_laporan, $lapC->id_laporan],
                $updateRes->json('data.synced_laporan_ids')
            );
        }

        // 4. Pastikan seluruh pelapor (A, B, C) melihat status Selesai, tanggapan terbaru, dan riwayat status lengkap
        foreach (
            [
                [$tokenA, $lapA->id_laporan, null],
                [$tokenB, $lapB->id_laporan, $initialEtagB],
                [$tokenC, $lapC->id_laporan, $initialEtagC],
            ] as [$userToken, $expectedId, $oldEtag]
        ) {
            $req = $this->withToken($userToken);
            if ($oldEtag !== null) {
                $req = $req->withHeader('If-None-Match', $oldEtag);
            }

            $res = $req->getJson('/api/laporan')->assertOk();
            if ($oldEtag !== null) {
                $this->assertNotSame($oldEtag, $res->headers->get('ETag'));
            }

            $report = collect($res->json('data'))->firstWhere('id_laporan', $expectedId);
            $this->assertNotNull($report);
            $this->assertSame('Selesai', $report['status_terkini']);
            $this->assertSame('Engsel pintu kelas 102 sudah selesai diganti dan berfungsi normal.', $report['pesan_tanggapan']);

            $statusHistory = array_column($report['riwayat_status'], 'status_laporan');
            $this->assertContains('Terkirim', $statusHistory);
            $this->assertContains('Sedang Diverifikasi', $statusHistory);
            $this->assertContains('Terverifikasi', $statusHistory);
            $this->assertContains('Proses', $statusHistory);
            $this->assertContains('Selesai', $statusHistory);
        }
    }
}
