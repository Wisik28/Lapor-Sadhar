<?php

namespace App\Services;

use App\Models\Laporan;
use App\Models\Status;
use App\Services\Priority\LocationCategorizer;
use App\Services\Priority\LocationSeverityAssessor;
use App\Support\SchemaVerification;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Carbon\Carbon;

/**
 * LaporanService - Business Logic untuk fitur Laporan
 * Mengelola CRUD dan operasi bisnis laporan
 */
class LaporanService
{
    private LocationCategorizer $locationCategorizer;
    private LocationSeverityAssessor $locationSeverityAssessor;

    /**
     * Cache verifikasi kolom lokasi per koneksi PDO untuk mencegah query skema berulang.
     *
     * @var array<int, bool>
     */
    private static array $verifiedColumnsByPdo = [];

    public function __construct(
        ?LocationCategorizer $locationCategorizer = null,
        ?LocationSeverityAssessor $locationSeverityAssessor = null
    ) {
        $this->locationCategorizer = $locationCategorizer ?? new LocationCategorizer();
        $this->locationSeverityAssessor = $locationSeverityAssessor ?? new LocationSeverityAssessor($this->locationCategorizer);
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
            if (SchemaVerification::isVerified('laporan_location_columns')) {
                return self::$verifiedColumnsByPdo[$pdoId] = true;
            }

            if (Schema::hasColumns('laporan', ['kategori_lokasi', 'tingkat_keparahan', 'skala_keparahan'])) {
                SchemaVerification::markVerified('laporan_location_columns');

                return self::$verifiedColumnsByPdo[$pdoId] = true;
            }

            if (DB::transactionLevel() > 0) {
                return false;
            }

            Schema::table('laporan', function (Blueprint $table) {
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

            SchemaVerification::markVerified('laporan_location_columns');

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

        return DB::transaction(function () use ($data, $locationAssessment, $hasLocationColumns) {
            $payload = [
                'nim'              => $data['nim'],
                'kategori_laporan' => $data['kategori_laporan'],
                'deskripsi'        => $data['deskripsi'],
                'tanggal_kejadian' => $data['tanggal_kejadian'],
                'lokasi'           => $data['lokasi'],
                'foto'             => $this->persistFotoPayload($data['foto'] ?? null),
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

        return DB::transaction(function () use ($id, $data, $hasLocationColumns) {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
                $q->orderBy('id_status', 'desc');
            }])->findOrFail($id);

            // Cek apakah laporan masih bisa diubah (hanya jika status "Terkirim")
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
                'lokasi'           => $newLokasi,
                'foto'             => isset($data['foto'])
                    ? $this->persistFotoPayload($data['foto'])
                    : $laporan->foto,
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
    }

    /**
     * Hapus laporan (hanya jika status Terkirim)
     */
    public function deleteLaporan(int $id): bool
    {
        return DB::transaction(function () use ($id) {
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

            return $laporan->delete();
        });
    }

    /**
     * Ambil semua laporan untuk admin
     */
    public function getAllLaporanForAdmin()
    {
        $laporans = Laporan::with([
            'statuses' => function ($query) {
                $query->orderBy('tanggal_merubah', 'desc');
                $query->orderBy('id_status', 'desc');
            },
            'pelapor.mahasiswa',
        ])
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

            if ($pesan) {
                $laporan->pesan_tanggapan = $pesan;
            }
            $laporan->tanggal_rubah = now();
            $laporan->save();

            return [
                'laporan' => $laporan->fresh(),
                'status'  => $statusRecord,
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

    private function persistFotoPayload(?string $foto): ?string
    {
        if ($foto === null || trim($foto) === '') {
            return null;
        }

        $decoded = json_decode($foto, true);
        $photos = is_array($decoded) && array_is_list($decoded) ? $decoded : [$foto];
        $storedPhotos = [];
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
        ];

        foreach ($photos as $photo) {
            if (!is_string($photo)) {
                throw new \InvalidArgumentException('Format foto laporan tidak valid.');
            }

            if (!preg_match('/^data:image\/[^;]+;base64,(.+)$/s', $photo, $matches)) {
                $storedPhotos[] = $photo;
                continue;
            }

            $contents = base64_decode($matches[1], true);
            if ($contents === false) {
                throw new \InvalidArgumentException('Data foto laporan tidak valid.');
            }

            $mimeType = (new \finfo(FILEINFO_MIME_TYPE))->buffer($contents);
            $extension = $extensions[$mimeType] ?? null;
            if ($extension === null) {
                throw new \InvalidArgumentException('Format foto harus berupa JPG, PNG, GIF, atau WebP.');
            }

            $path = 'laporan/' . Str::uuid() . '.' . $extension;
            if (!Storage::disk('public')->put($path, $contents)) {
                throw new \RuntimeException('Foto laporan gagal disimpan.');
            }

            $storedPhotos[] = 'storage/' . $path;
        }

        return count($storedPhotos) > 1
            ? json_encode($storedPhotos, JSON_THROW_ON_ERROR)
            : ($storedPhotos[0] ?? null);
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
