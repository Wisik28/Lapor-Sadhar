<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        // #11: Indeks komposit untuk lookup status terbaru per laporan (eager load & correlated subquery)
        if (Schema::hasTable('status')) {
            if ($driver === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS status_laporan_latest_idx ON status (id_laporan, tanggal_merubah DESC, id_status DESC)');
            } else {
                Schema::table('status', function (Blueprint $table) {
                    $table->index(['id_laporan', 'tanggal_merubah', 'id_status'], 'status_laporan_latest_idx');
                });
            }
        }

        // #33: Ubah FK laporan.nim -> pelapor.nomor_identitas dari ON DELETE CASCADE menjadi ON DELETE RESTRICT
        if (Schema::hasTable('laporan') && Schema::hasTable('pelapor')) {
            Schema::table('laporan', function (Blueprint $table) {
                $table->dropForeign(['nim']);
            });

            Schema::table('laporan', function (Blueprint $table) {
                $table->foreign('nim')
                    ->references('nomor_identitas')
                    ->on('pelapor')
                    ->restrictOnDelete()
                    ->cascadeOnUpdate();
            });
        }

        // #33: Tambahkan FK admin_id -> admin.admin_id (ON DELETE SET NULL) pada tabel prioritas
        if (Schema::hasTable('admin') && Schema::hasTable('priority_assessments') && Schema::hasColumn('priority_assessments', 'admin_id')) {
            DB::table('priority_assessments')
                ->whereNotNull('admin_id')
                ->whereNotIn('admin_id', DB::table('admin')->select('admin_id'))
                ->update(['admin_id' => null]);

            Schema::table('priority_assessments', function (Blueprint $table) {
                $table->foreign('admin_id', 'priority_assessments_admin_id_foreign')
                    ->references('admin_id')
                    ->on('admin')
                    ->nullOnDelete()
                    ->cascadeOnUpdate();
            });
        }

        if (Schema::hasTable('admin') && Schema::hasTable('priority_feedback') && Schema::hasColumn('priority_feedback', 'admin_id')) {
            DB::table('priority_feedback')
                ->whereNotNull('admin_id')
                ->whereNotIn('admin_id', DB::table('admin')->select('admin_id'))
                ->update(['admin_id' => null]);

            Schema::table('priority_feedback', function (Blueprint $table) {
                $table->foreign('admin_id', 'priority_feedback_admin_id_foreign')
                    ->references('admin_id')
                    ->on('admin')
                    ->nullOnDelete()
                    ->cascadeOnUpdate();
            });
        }

        // #33: Tambahkan CHECK constraint untuk nilai enum domain di PostgreSQL
        if ($driver === 'pgsql') {
            $checks = [
                "ALTER TABLE laporan ADD CONSTRAINT laporan_kategori_laporan_check CHECK (kategori_laporan IN ('Fasilitas', 'Kebersihan'))",
                "ALTER TABLE laporan ADD CONSTRAINT laporan_lokasi_kampus_check CHECK (lokasi_kampus IS NULL OR lokasi_kampus IN ('Kampus 1', 'Kampus 2', 'Kampus 3', 'Kampus 4'))",
                "ALTER TABLE status ADD CONSTRAINT status_status_laporan_check CHECK (status_laporan IN ('Terkirim', 'Sedang Diverifikasi', 'Diverifikasi', 'Terverifikasi', 'Proses', 'Diproses', 'Selesai', 'Ditolak'))",
                "ALTER TABLE admin ADD CONSTRAINT admin_role_check CHECK (role IN ('BPS', 'BLU', 'BOTH'))",
                "ALTER TABLE pelapor ADD CONSTRAINT pelapor_tipe_user_check CHECK (tipe_user IN ('mahasiswa', 'karyawan'))",
            ];

            foreach ($checks as $sql) {
                DB::statement("DO $$ BEGIN {$sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
            }
        }

        // #34: Tabel persistensi status baca laporan admin lintas perangkat/browser
        if (! Schema::hasTable('admin_report_reads')) {
            Schema::create('admin_report_reads', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('admin_id');
                $table->unsignedBigInteger('id_laporan');
                $table->timestamp('read_at')->useCurrent();

                $table->unique(['admin_id', 'id_laporan'], 'admin_report_reads_admin_laporan_unique');
                $table->index('admin_id', 'admin_report_reads_admin_idx');
                $table->foreign('admin_id')
                    ->references('admin_id')
                    ->on('admin')
                    ->cascadeOnDelete()
                    ->cascadeOnUpdate();
                $table->foreign('id_laporan')
                    ->references('id_laporan')
                    ->on('laporan')
                    ->cascadeOnDelete()
                    ->cascadeOnUpdate();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        Schema::dropIfExists('admin_report_reads');

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE laporan DROP CONSTRAINT IF EXISTS laporan_kategori_laporan_check');
            DB::statement('ALTER TABLE laporan DROP CONSTRAINT IF EXISTS laporan_lokasi_kampus_check');
            DB::statement('ALTER TABLE status DROP CONSTRAINT IF EXISTS status_status_laporan_check');
            DB::statement('ALTER TABLE admin DROP CONSTRAINT IF EXISTS admin_role_check');
            DB::statement('ALTER TABLE pelapor DROP CONSTRAINT IF EXISTS pelapor_tipe_user_check');
        }

        if (Schema::hasTable('priority_feedback')) {
            Schema::table('priority_feedback', function (Blueprint $table) {
                $table->dropForeign('priority_feedback_admin_id_foreign');
            });
        }

        if (Schema::hasTable('priority_assessments')) {
            Schema::table('priority_assessments', function (Blueprint $table) {
                $table->dropForeign('priority_assessments_admin_id_foreign');
            });
        }

        if (Schema::hasTable('laporan') && Schema::hasTable('pelapor')) {
            Schema::table('laporan', function (Blueprint $table) {
                $table->dropForeign(['nim']);
            });

            Schema::table('laporan', function (Blueprint $table) {
                $table->foreign('nim')
                    ->references('nomor_identitas')
                    ->on('pelapor')
                    ->cascadeOnDelete()
                    ->cascadeOnUpdate();
            });
        }

        if (Schema::hasTable('status')) {
            if ($driver === 'pgsql') {
                DB::statement('DROP INDEX IF EXISTS status_laporan_latest_idx');
            } else {
                Schema::table('status', function (Blueprint $table) {
                    $table->dropIndex('status_laporan_latest_idx');
                });
            }
        }
    }
};

