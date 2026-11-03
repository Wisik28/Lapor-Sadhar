<?php

namespace App\Services;

use App\Models\Laporan;
use App\Models\Status;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * LaporanService - Business Logic untuk fitur Laporan
 * Mengelola CRUD dan operasi bisnis laporan
 */
class LaporanService
{
    /**
     * Buat laporan baru
     */
    public function createLaporan(array $data): Laporan
    {
        return DB::transaction(function () use ($data) {
            $laporan = Laporan::create([
                'nim'              => $data['nim'],
                'kategori_laporan' => $data['kategori_laporan'],
                'deskripsi'        => $data['deskripsi'],
                'tanggal_kejadian' => $data['tanggal_kejadian'],
                'lokasi'           => $data['lokasi'],
                'foto'             => $data['foto'] ?? null,
                'tanggal_buat'     => now(),
            ]);

            // Buat status awal: Terkirim
            Status::create([
                'id_laporan'      => $laporan->id_laporan,
                'status_laporan'  => 'Terkirim',
                'tanggal_merubah' => now(),
            ]);

            return $laporan->fresh()->load('statuses');
        });
    }

    /**
     * Ambil semua laporan milik user (berdasarkan NIM)
     */
    public function getAllLaporanByNim(string $nim)
    {
        $laporans = Laporan::with(['statuses' => function ($q) {
            $q->orderBy('tanggal_merubah', 'desc');
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
        return DB::transaction(function () use ($id, $data) {
            $laporan = Laporan::with(['statuses' => function ($q) {
                $q->orderBy('tanggal_merubah', 'desc');
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

            $laporan->update([
                'kategori_laporan' => $data['kategori_laporan'] ?? $laporan->kategori_laporan,
                'deskripsi'        => $data['deskripsi'] ?? $laporan->deskripsi,
                'tanggal_kejadian' => $data['tanggal_kejadian'] ?? $laporan->tanggal_kejadian,
                'lokasi'           => $data['lokasi'] ?? $laporan->lokasi,
                'foto'             => $data['foto'] ?? $laporan->foto,
                'tanggal_rubah'    => now(),
            ]);

            return $laporan->fresh()->load('statuses');
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

            $bulan = Carbon::parse($laporan->tanggal_buat)->format('Y-m');
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
     * Format laporan response
     */
    private function formatLaporanResponse(Laporan $laporan): array
    {
        $latestStatus = $laporan->statuses->first();

        return [
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
            'pesan_tanggapan'  => $laporan->pesan_tanggapan ?? '',
            'status_terkini'   => $latestStatus?->status_laporan ?? 'Terkirim',
            'riwayat_status'   => $laporan->statuses,
        ];
    }
}
