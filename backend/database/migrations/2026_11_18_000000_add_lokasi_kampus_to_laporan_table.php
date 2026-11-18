<?php

use App\Models\Admin;
use App\Models\Laporan;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('laporan')) {
            if (! Schema::hasColumn('laporan', 'lokasi_kampus')) {
                Schema::table('laporan', function (Blueprint $table) {
                    $table->string('lokasi_kampus', 20)->nullable()->after('lokasi');
                    $table->index('lokasi_kampus');
                });
            }

            // Backfill lokasi_kampus untuk data laporan lama; default 'Kampus 3' jika tidak terdeteksi
            DB::table('laporan')
                ->whereNull('lokasi_kampus')
                ->orWhere('lokasi_kampus', '')
                ->orderBy('id_laporan')
                ->get(['id_laporan', 'lokasi'])
                ->each(function (object $row): void {
                    DB::table('laporan')
                        ->where('id_laporan', $row->id_laporan)
                        ->update([
                            'lokasi_kampus' => Laporan::inferCampusFromLokasi($row->lokasi, 'Kampus 3'),
                        ]);
                });
        }

        // Sinkronkan kolom campus pada tabel admin agar sesuai jabatan (Kampus 1..4 atau null untuk pusat)
        if (Schema::hasTable('admin') && Schema::hasColumn('admin', 'campus')) {
            foreach (Admin::POSITIONS as $jabatan => $definition) {
                DB::table('admin')
                    ->where('jabatan', $jabatan)
                    ->update(['campus' => $definition['campus']]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('laporan') && Schema::hasColumn('laporan', 'lokasi_kampus')) {
            Schema::table('laporan', function (Blueprint $table) {
                $table->dropIndex(['lokasi_kampus']);
                $table->dropColumn('lokasi_kampus');
            });
        }
    }
};

