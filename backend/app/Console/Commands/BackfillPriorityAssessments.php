<?php

namespace App\Console\Commands;

use App\Models\Laporan;
use App\Services\Priority\PriorityScoringService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillPriorityAssessments extends Command
{
    protected $signature = 'priority:backfill
        {--chunk=100 : Jumlah laporan yang diproses per batch}
        {--force : Hitung ulang seluruh laporan termasuk yang sudah memiliki penilaian}';

    protected $description = 'Mengisi atau menghitung ulang data priority_assessments secara offline tanpa write-on-read saat HTTP GET.';

    public function handle(PriorityScoringService $scoringService): int
    {
        if (! $scoringService->ensureTablesExist()) {
            $this->error('Tabel priority_assessments tidak tersedia.');

            return self::FAILURE;
        }

        $chunkSize = max(1, min(500, (int) $this->option('chunk')));
        $force = (bool) $this->option('force');

        $query = Laporan::query()
            ->select([
                'laporan.id_laporan',
                'laporan.nim',
                'laporan.kategori_laporan',
                'laporan.deskripsi',
                'laporan.tanggal_buat',
                'laporan.tanggal_kejadian',
                'laporan.lokasi_kampus',
                'laporan.lokasi',
                'laporan.kategori_lokasi',
                'laporan.tingkat_keparahan',
                'laporan.skala_keparahan',
                DB::raw("CASE WHEN laporan.foto IS NOT NULL AND laporan.foto <> '' THEN 1 ELSE 0 END AS has_foto"),
            ]);

        if (! $force) {
            $query->whereNotExists(function ($subQuery) {
                $subQuery->select(DB::raw(1))
                    ->from('priority_assessments')
                    ->whereColumn('priority_assessments.id_laporan', 'laporan.id_laporan');
            });
        }

        $processed = 0;
        $query->orderBy('laporan.id_laporan')->chunkById($chunkSize, function ($laporans) use ($scoringService, $force, &$processed): void {
            $scoringService->assessAndSaveMany($laporans, $force);
            $processed += $laporans->count();
        }, 'laporan.id_laporan', 'id_laporan');

        $this->info("Backfill prioritas selesai. Total laporan diproses: {$processed}.");

        return self::SUCCESS;
    }
}

