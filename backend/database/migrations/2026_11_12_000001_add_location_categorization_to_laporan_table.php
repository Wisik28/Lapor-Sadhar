<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('laporan')) {
            Schema::table('laporan', function (Blueprint $table) {
                if (!Schema::hasColumn('laporan', 'kategori_lokasi')) {
                    $table->string('kategori_lokasi', 60)->default('Tidak Diketahui')->after('lokasi');
                }
                if (!Schema::hasColumn('laporan', 'tingkat_keparahan')) {
                    $table->string('tingkat_keparahan', 30)->default('Sedang')->after('kategori_lokasi');
                }
                if (!Schema::hasColumn('laporan', 'skala_keparahan')) {
                    $table->unsignedTinyInteger('skala_keparahan')->default(2)->after('tingkat_keparahan');
                }
            });
        }

        if (Schema::hasTable('priority_assessments')) {
            Schema::table('priority_assessments', function (Blueprint $table) {
                if (!Schema::hasColumn('priority_assessments', 'kategori_lokasi')) {
                    $table->string('kategori_lokasi', 60)->default('Tidak Diketahui')->after('kategori');
                }
                if (!Schema::hasColumn('priority_assessments', 'tingkat_keparahan_lokasi')) {
                    $table->string('tingkat_keparahan_lokasi', 30)->default('Sedang')->after('kategori_lokasi');
                }
                if (!Schema::hasColumn('priority_assessments', 'skala_keparahan_lokasi')) {
                    $table->unsignedTinyInteger('skala_keparahan_lokasi')->default(2)->after('tingkat_keparahan_lokasi');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('laporan')) {
            Schema::table('laporan', function (Blueprint $table) {
                $columns = array_filter(
                    ['kategori_lokasi', 'tingkat_keparahan', 'skala_keparahan'],
                    fn (string $col) => Schema::hasColumn('laporan', $col)
                );
                if (!empty($columns)) {
                    $table->dropColumn($columns);
                }
            });
        }

        if (Schema::hasTable('priority_assessments')) {
            Schema::table('priority_assessments', function (Blueprint $table) {
                $columns = array_filter(
                    ['kategori_lokasi', 'tingkat_keparahan_lokasi', 'skala_keparahan_lokasi'],
                    fn (string $col) => Schema::hasColumn('priority_assessments', $col)
                );
                if (!empty($columns)) {
                    $table->dropColumn($columns);
                }
            });
        }
    }
};

