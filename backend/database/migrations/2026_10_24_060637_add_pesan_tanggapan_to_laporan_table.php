<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('laporan', 'pesan_tanggapan')) {
            Schema::table('laporan', function (Blueprint $table) {
                $table->text('pesan_tanggapan')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('laporan', 'pesan_tanggapan')) {
            Schema::table('laporan', function (Blueprint $table) {
                $table->dropColumn('pesan_tanggapan');
            });
        }
    }
};