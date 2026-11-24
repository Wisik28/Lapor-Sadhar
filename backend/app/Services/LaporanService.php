<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\Laporan;
use App\Models\Priority\PriorityAssessment;
use App\Models\Status;
use App\Services\Priority\LocationCategorizer;
use App\Services\Priority\LocationSeverityAssessor;
use App\Support\SchemaVerification;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

/**
 * LaporanService - Business Logic untuk fitur Laporan
 * Mengelola CRUD dan operasi bisnis laporan
 */
class LaporanService
{
    private LocationCategorizer $locationCategorizer;
    private LocationSeverityAssessor $locationSeverityAssessor;
    private CloudinaryStorageService $cloudinaryStorage;

    /**
     * Cache verifikasi kolom lokasi per koneksi PDO untuk mencegah query skema berulang.
     *
     * @var array<int, bool>
     */
    private static array $verifiedColumnsByPdo = [];

    public function __construct(
        ?LocationCategorizer $locationCategorizer = null,
        ?LocationSeverityAssessor $locationSeverityAssessor = null,
        ?CloudinaryStorageService $cloudinaryStorage = null
    ) {
        $this->locationCategorizer = $locationCategorizer ?? new LocationCategorizer();
        $this->locationSeverityAssessor = $locationSeverityAssessor ?? new LocationSeverityAssessor($this->locationCategorizer);
        $this->cloudinaryStorage = $cloudinaryStorage ?? new CloudinaryStorageService();
    }

    /**
     * Pastikan kolom kategorisasi lokasi tersedia pada tabel laporan.
     * Aman terhadap transaksi PostgreSQL (tidak pernah membatalkan transaksi aktif).
     */
    private function ensureLocationColumnsOnLaporan(): bool
    {
        try {
            $pdoId = spl_object_id(DB::connection()->getPdo());
            if (!empty(self::$verifiedColumnsByPdo[$pdoId])) {
                return true;
            }

            // Sudah diverifikasi pada request sebelumnya: lewati query skema ke database jarak jauh.
            if (SchemaVerification::isVerified('laporan_location_columns_v2')) {
                return self::$verifiedColumnsByPdo[$pdoId] = true;
            }

            if (Schema::hasColumns('laporan', ['kategori_lokasi', 'tingkat_keparahan', 'skala_keparahan', 'lokasi_kampus'])) {
                SchemaVerification::markVerified('laporan_location_columns_v2');

                return self::$verifiedColumnsByPdo[$pdoId] = true;
            }

            if (DB::transactionLevel() > 0) {
                return false;
            }

            Schema::table('laporan', function (Blueprint $table) {
                if (!Schema::hasColumn('laporan', 'lokasi_kampus')) {
                    $table->string('lokasi_kampus', 20)->nullable()->after('lokasi');
                }
                if (!Schema::hasColumn('laporan', 'kategori_lokasi')) {
                    $table->string('kategori_lokasi', 60)->default('Tidak Diketahui');
                }
                if (!Schema::hasColumn('laporan', 'tingkat_keparahan')) {
                    $table->string('tingkat_keparahan', 30)->default('Sedang');
                }
                if (!Schema::hasColumn('laporan', 'skala_keparahan')) {
                    $table->unsignedTinyInteger('skala_keparahan')->default(2);
                }
            });

            SchemaVerification::markVerified('laporan_location_columns_v2');

            return self::$verifiedColumnsByPdo[$pdoId] = true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Buat laporan baru beserta kategorisasi lokasi dan tingkat keparahan awal secara otomatis
     */
    public function createLaporan(array $data): Laporan
    {
        $locationAssessment = $this->locationSeverityAssessor->assessLocation($data['lokasi'] ?? '');
        $hasLocationColumns = $this->ensureLocationColumnsOnLaporan();
        $uploadedUrls = [];

        try {
            $persistedFoto = $this->persistFotoPayload($data['foto'] ?? null, $uploadedUrls);

            return DB::transaction(function () use ($data, $locationAssessment, $hasLocationColumns, $persistedFoto) {
                $payload = [
                    'nim'              => $data['nim'],
                    'kategori_laporan' => $data['kategori_laporan'],
                    'deskripsi'        => $data['deskripsi'],
                    'tanggal_kejadian' => $data['tanggal_kejadian'],
                    'lokasi_kampus'    => $data['lokasi_kampus'] ?? Laporan::inferCampusFromLokasi($data['lokasi'] ?? null),
                    'lokasi'           => $data['lokasi'],
                    'foto'             => $persistedFoto,
                    'tanggal_buat'     => now(),
                ];

                if ($hasLocationColumns) {
                    $payload['kategori_lokasi']   = $locationAssessment['kategori_lokasi'];
                    $payload['tingkat_keparahan'] = $locationAssessment['tingkat_keparahan'];
                    $payload['skala_keparahan']   = $locationAssessment['skala_keparahan'];
                }

                $laporan = Laporan::create($payload);

                // Buat status awal: Terkirim
                Status::create([
                    'id_laporan'      => $laporan->id_laporan,
                    'status_laporan'  => 'Terkirim',
                    'tanggal_merubah' => now(),
                ]);

                $result = $laporan->fresh()->load('statuses');
                $result->setAttribute('kategori_lokasi', $result->kategori_lokasi ?? $locationAssessment['kategori_lokasi']);
                $result->setAttribute('tingkat_keparahan', $result->tingkat_keparahan ?? $locationAssessment['tingkat_keparahan']);
                $result->setAttribute('skala_keparahan', (int) ($result->skala_keparahan ?? $locationAssessment['skala_keparahan']));

                return $result;
            });
        } catch (\Throwable $e) {
            foreach ($uploadedUrls as $url) {
                $this->cloudinaryStorage->deleteByUrl($url);
            }

            throw $e;
        }
    }

    /**
     * Ambil semua laporan milik user (berdasarkan NIM)
     */
    public function getAllLaporanByNim(string $nim)
    {
        $laporans = Laporan::with(['statuses' => function ($q) {
            $q->orderBy('tanggal_merubah', 'desc');
            $q->orderBy('id_status', 'desc');
        }])
            ->where('nim', $nim)
            ->orderBy('tanggal_buat', 'desc')
            ->get()
            ->map(function ($laporan) {
                return $this->formatLaporanResponse($laporan);
            });

        return $laporans;
    }

    /**
     * Ambil detail satu laporan
     */
    public function getLaporanById(int $id)
    {
        $laporan = Laporan::with([
            'statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
                $q->orderBy('id_status', 'desc');
            },
            'pelapor.mahasiswa',
            'pelapor.pegawai'
        ])->findOrFail($id);

        return $this->formatLaporanResponse($laporan);
    }

    /**
     * Update laporan (hanya jika status Terkirim)
     */
    public function updateLaporan(int $id, array $data): Laporan
    {
        $hasLocationColumns = $this->ensureLocationColumnsOnLaporan();
        $existingLaporan = Laporan::with(['statuses' => function ($q) {
            $q->orderBy('tanggal_merubah', 'desc');
            $q->orderBy('id_status', 'desc');
        }])->findOrFail($id);

        // Cek apakah laporan masih bisa diubah (hanya jika status "Terkirim") sebelum upload ke Cloudinary
        $latestStatus = $existingLaporan->statuses->first()?->status_laporan ?? 'Terkirim';

        if ($latestStatus !== 'Terkirim') {
            throw new \Exception(
                "Laporan tidak dapat diubah karena statusnya sudah \"$latestStatus\". "
                . "Hanya laporan berstatus \"Terkirim\" yang dapat diperbarui.",
                403
            );
        }

        $oldFoto = $existingLaporan->foto;
        $hasNewFotoInput = isset($data['foto']);
        $uploadedUrls = [];

        try {
            $persistedFoto = $hasNewFotoInput
                ? $this->persistFotoPayload($data['foto'], $uploadedUrls)
                : $oldFoto;

            $result = DB::transaction(function () use ($id, $data, $hasLocationColumns, $persistedFoto) {
                $laporan = Laporan::with(['statuses' => function ($q) {
                    $q->orderBy('tanggal_merubah', 'desc');
                    $q->orderBy('id_status', 'desc');
                }])->findOrFail($id);

                $latestStatus = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';
                if ($latestStatus !== 'Terkirim') {
                    throw new \Exception(
                        "Laporan tidak dapat diubah karena statusnya sudah \"$latestStatus\". "
                        . "Hanya laporan berstatus \"Terkirim\" yang dapat diperbarui.",
                        403
                    );
                }

                $newLokasi = $data['lokasi'] ?? $laporan->lokasi;
                $locationAssessment = $this->locationSeverityAssessor->assessLocation($newLokasi);

                $updatePayload = [
                    'kategori_laporan' => $data['kategori_laporan'] ?? $laporan->kategori_laporan,
                    'deskripsi'        => $data['deskripsi'] ?? $laporan->deskripsi,
                    'tanggal_kejadian' => $data['tanggal_kejadian'] ?? $laporan->tanggal_kejadian,
                    'lokasi_kampus'    => $data['lokasi_kampus'] ?? $laporan->lokasi_kampus,
                    'lokasi'           => $newLokasi,
                    'foto'             => $persistedFoto,
                    'tanggal_rubah'    => now(),
                ];

                if ($hasLocationColumns) {
                    $updatePayload['kategori_lokasi']   = $locationAssessment['kategori_lokasi'];
                    $updatePayload['tingkat_keparahan'] = $locationAssessment['tingkat_keparahan'];
                    $updatePayload['skala_keparahan']   = $locationAssessment['skala_keparahan'];
                }

                $laporan->update($updatePayload);

                $result = $laporan->fresh()->load('statuses');
                $result->setAttribute('kategori_lokasi', $result->kategori_lokasi ?? $locationAssessment['kategori_lokasi']);
                $result->setAttribute('tingkat_keparahan', $result->tingkat_keparahan ?? $locationAssessment['tingkat_keparahan']);
                $result->setAttribute('skala_keparahan', (int) ($result->skala_keparahan ?? $locationAssessment['skala_keparahan']));

                return $result;
            });
        } catch (\Throwable $e) {
            foreach ($uploadedUrls as $url) {
                $this->cloudinaryStorage->deleteByUrl($url);
            }

            throw $e;
        }

        if ($hasNewFotoInput) {
            $retainedUrls = $this->extractStoredPhotoItems($persistedFoto);
            foreach ($this->extractStoredPhotoItems($oldFoto) as $oldUrl) {
                if (! in_array($oldUrl, $retainedUrls, true)) {
                    $this->cloudinaryStorage->deleteByUrl($oldUrl);
                }
            }
        }

        return $result;
    }

    /**
     * Hapus laporan (hanya jika status Terkirim)
     */
    public function deleteLaporan(int $id): bool
    {
        $oldFoto = null;

        $deleted = DB::transaction(function () use ($id, &$oldFoto) {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
                $q->orderBy('id_status', 'desc');
            }])->findOrFail($id);

            $latestStatus = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';

            if ($latestStatus !== 'Terkirim') {
                throw new \Exception(
                    "Laporan tidak dapat dihapus karena statusnya sudah \"$latestStatus\".",
                    403
                );
            }

            $oldFoto = $laporan->foto;

            return $laporan->delete();
        });

        if ($deleted) {
            foreach ($this->extractStoredPhotoItems($oldFoto) as $url) {
                $this->cloudinaryStorage->deleteByUrl($url);
            }
        }

        return $deleted;
    }

    /**
     * Ambil semua laporan untuk admin sesuai cakupan kampus dan unitnya.
     */
    public function getAllLaporanForAdmin(?Admin $admin = null)
    {
        $laporans = Laporan::with([
            'statuses' => function ($query) {
                $query->orderBy('tanggal_merubah', 'desc');
                $query->orderBy('id_status', 'desc');
            },
            'pelapor.mahasiswa',
        ])
            ->visibleToAdmin($admin)
            ->orderBy('tanggal_buat', 'desc')
            ->get()
            ->map(function ($laporan) {
                return $this->formatLaporanResponse($laporan);
            });

        return $laporans;
    }

    /**
     * Update status laporan (admin only)
     */
    public function updateStatusLaporan(int $id, string $status, string $pesan = ''): array
    {
        return DB::transaction(function () use ($id, $status, $pesan) {
            $laporan = Laporan::findOrFail($id);

            $statusRecord = Status::create([
                'id_laporan'      => $laporan->id_laporan,
                'status_laporan'  => $status,
                'tanggal_merubah' => now(),
            ]);

            // Selalu simpan tanggapan, termasuk saat admin mengosongkan tanggapan lama.
            $laporan->pesan_tanggapan = $pesan;
            $laporan->tanggal_rubah = now();
            $laporan->save();

            $laporan->load([
                'statuses' => function ($query) {
                    $query->orderBy('tanggal_merubah', 'desc');
                    $query->orderBy('id_status', 'desc');
                },
            ]);

            return [
                'laporan' => $laporan,
                'status'  => $statusRecord,
            ];
        });
    }

    /**
     * Pindahkan kategori laporan antar unit (BPS <-> BLU) apabila salah masuk kategori.
     */
    public function transferKategoriLaporan(
        int $id,
        string $targetKategori,
        ?Admin $admin = null,
        ?string $catatan = null
    ): array {
        return DB::transaction(function () use ($id, $targetKategori, $catatan) {
            $laporan = Laporan::with([
                'statuses' => function ($query) {
                    $query->orderBy('tanggal_merubah', 'desc');
                    $query->orderBy('id_status', 'desc');
                },
            ])->findOrFail($id);

            $oldKategori = (string) $laporan->kategori_laporan;

            if (strcasecmp($oldKategori, $targetKategori) === 0) {
                throw new \InvalidArgumentException(
                    "Laporan sudah berada pada kategori {$targetKategori}."
                );
            }

            $latestStatus = (string) ($laporan->statuses->first()?->status_laporan ?? 'Terkirim');
            if (in_array(strtolower(trim($latestStatus)), ['selesai', 'ditolak'], true)) {
                throw new \InvalidArgumentException(
                    "Laporan yang sudah berstatus {$latestStatus} tidak dapat dipindahkan ke unit lain."
                );
            }

            $unitAsal = strcasecmp($oldKategori, 'Kebersihan') === 0 ? 'BLU' : 'BPS';
            $unitTujuan = strcasecmp($targetKategori, 'Kebersihan') === 0 ? 'BLU' : 'BPS';

            $laporan->kategori_laporan = $targetKategori;
            $laporan->tanggal_rubah = now();

            $trimmedCatatan = trim((string) ($catatan ?? ''));
            if ($trimmedCatatan !== '') {
                $transferLine = "[Dipindahkan dari {$unitAsal} ke {$unitTujuan}] {$trimmedCatatan}";
                $existingNote = trim((string) ($laporan->pesan_tanggapan ?? ''));
                $laporan->pesan_tanggapan = $existingNote !== ''
                    ? $existingNote . "\n" . $transferLine
                    : $transferLine;
            }

            $laporan->save();

            if (Schema::hasTable('priority_assessments')) {
                PriorityAssessment::where('id_laporan', $laporan->id_laporan)
                    ->update(['kategori' => $targetKategori]);
            }

            return [
                'id_laporan'          => $laporan->id_laporan,
                'kategori_sebelumnya' => $oldKategori,
                'kategori_laporan'    => $laporan->kategori_laporan,
                'unit_asal'           => $unitAsal,
                'unit_tujuan'         => $unitTujuan,
                'lokasi_kampus'       => $laporan->lokasi_kampus,
                'pesan_tanggapan'     => $laporan->pesan_tanggapan ?? '',
                'tanggal_rubah'       => $laporan->tanggal_rubah,
            ];
        });
    }

    /**
     * Rekap laporan per user (statistik)
     */
    public function getRekapLaporanByNim(string $nim): array
    {
        $laporans = Laporan::with(['statuses' => function ($q) {
            $q->orderBy('tanggal_merubah', 'desc');
            $q->orderBy('id_status', 'desc');
        }])->where('nim', $nim)->get();

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

        $bulanCounts = [];

        foreach ($laporans as $laporan) {
            $terkini = $laporan->statuses->first()?->status_laporan ?? 'Terkirim';
            if (isset($statusCounts[$terkini])) {
                $statusCounts[$terkini]++;
            }

            $kat = $laporan->kategori_laporan;
            if (isset($kategoriCounts[$kat])) {
                $kategoriCounts[$kat]++;
            }

            $rawBuat = (string) $laporan->tanggal_buat;
            $bulan = (strlen($rawBuat) >= 7 && $rawBuat[4] === '-')
                ? substr($rawBuat, 0, 7)
                : Carbon::parse($laporan->tanggal_buat)->format('Y-m');
            $bulanCounts[$bulan] = ($bulanCounts[$bulan] ?? 0) + 1;
        }

        ksort($bulanCounts);

        $bulanFormatted = [];
        foreach ($bulanCounts as $key => $count) {
            $bulanFormatted[] = [
                'bulan'  => Carbon::createFromFormat('Y-m', $key)->locale('id')->isoFormat('MMMM YYYY'),
                'key'    => $key,
                'jumlah' => $count,
            ];
        }

        return [
            'nim'              => $nim,
            'total_laporan'    => $laporans->count(),
            'per_status'       => $statusCounts,
            'per_kategori'     => $kategoriCounts,
            'per_bulan'        => $bulanFormatted,
            'laporan_aktif'    => $statusCounts['Terkirim'] + $statusCounts['Diverifikasi'] + $statusCounts['Diproses'],
            'laporan_selesai'  => $statusCounts['Selesai'],
            'laporan_ditolak'  => $statusCounts['Ditolak'],
        ];
    }

    /**
     * Unggah gambar baru ke Cloudinary dan kembalikan URL (string tunggal atau JSON array) untuk disimpan di PostgreSQL.
     *
     * @param  mixed  $foto
     * @param  array<int, string>  $uploadedUrls
     */
    private function persistFotoPayload(mixed $foto, array &$uploadedUrls = []): ?string
    {
        if ($foto === null) {
            return null;
        }

        if (is_string($foto)) {
            $trimmed = trim($foto);
            if ($trimmed === '') {
                return null;
            }
            $decoded = json_decode($trimmed, true);
            $photos = is_array($decoded) && array_is_list($decoded) ? $decoded : [$trimmed];
        } elseif ($foto instanceof UploadedFile) {
            $photos = [$foto];
        } elseif (is_array($foto)) {
            $photos = array_values($foto);
        } else {
            throw new \InvalidArgumentException('Format foto laporan tidak valid.');
        }

        $storedUrls = [];

        foreach ($photos as $photo) {
            if ($photo instanceof UploadedFile) {
                $url = $this->cloudinaryStorage->uploadUploadedFile($photo);
                $uploadedUrls[] = $url;
                $storedUrls[] = $url;
                continue;
            }

            if (! is_string($photo) || trim($photo) === '') {
                throw new \InvalidArgumentException('Format foto laporan tidak valid.');
            }

            $trimmedPhoto = trim($photo);

            if (preg_match('/^data:image\/[^;]+;base64,(.+)$/s', $trimmedPhoto, $matches) === 1) {
                $contents = base64_decode($matches[1], true);
                if ($contents === false) {
                    throw new \InvalidArgumentException('Data foto laporan tidak valid.');
                }

                $extension = $this->cloudinaryStorage->detectSupportedExtension($contents);
                $url = $this->cloudinaryStorage->uploadImage($contents, $extension);
                $uploadedUrls[] = $url;
                $storedUrls[] = $url;
                continue;
            }

            if (
                filter_var($trimmedPhoto, FILTER_VALIDATE_URL) !== false
                && preg_match('/^https?:\/\//i', $trimmedPhoto) === 1
            ) {
                $storedUrls[] = $trimmedPhoto;
                continue;
            }

            if (str_starts_with($trimmedPhoto, 'storage/')) {
                $storedUrls[] = $trimmedPhoto;
                continue;
            }

            throw new \InvalidArgumentException('Format foto laporan tidak valid. Gunakan gambar atau URL yang valid.');
        }

        if ($storedUrls === []) {
            return null;
        }

        return count($storedUrls) > 1
            ? json_encode($storedUrls, JSON_THROW_ON_ERROR)
            : $storedUrls[0];
    }

    /**
     * @return array<int, string>
     */
    private function extractStoredPhotoItems(?string $foto): array
    {
        if ($foto === null || trim($foto) === '') {
            return [];
        }

        $decoded = json_decode($foto, true);
        if (is_array($decoded) && array_is_list($decoded)) {
            return array_values(array_filter($decoded, static fn ($item): bool => is_string($item) && trim($item) !== ''));
        }

        return [trim($foto)];
    }

    /**
     * Format laporan response
     */
    private function formatLaporanResponse(Laporan $laporan): array
    {
        $latestStatus = $laporan->statuses->first();
        $locationAssessment = $this->locationSeverityAssessor->assessLocation($laporan->lokasi);

        return [
            'id_laporan'        => $laporan->id_laporan,
            'nim'               => $laporan->nim,
            'nama_pelapor'      => $laporan->pelapor?->mahasiswa?->nama ?? $laporan->pelapor?->pegawai?->nama,
            'kategori_laporan'  => $laporan->kategori_laporan,
            'deskripsi'         => $laporan->deskripsi,
            'tanggal_kejadian'  => $laporan->tanggal_kejadian,
            'tanggal_buat'      => $laporan->tanggal_buat,
            'tanggal_rubah'     => $laporan->tanggal_rubah,
            'lokasi_kampus'     => $laporan->lokasi_kampus,
            'lokasi'            => $laporan->lokasi,
            'kategori_lokasi'   => $laporan->kategori_lokasi ?: $locationAssessment['kategori_lokasi'],
            'tingkat_keparahan' => $laporan->tingkat_keparahan ?: $locationAssessment['tingkat_keparahan'],
            'skala_keparahan'   => (int) ($laporan->skala_keparahan ?: $locationAssessment['skala_keparahan']),
            'foto'              => $laporan->foto,
            'pesan_tanggapan'   => $laporan->pesan_tanggapan ?? '',
            'status_terkini'    => $latestStatus?->status_laporan ?? 'Terkirim',
            'riwayat_status'    => $laporan->statuses,
        ];
    }
}
