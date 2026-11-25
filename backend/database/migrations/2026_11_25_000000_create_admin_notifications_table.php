<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_notifications')) {
            return;
        }

        Schema::create('admin_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->unsignedBigInteger('id_laporan');
            $table->string('jenis_aktivitas', 30); // 'laporan_baru' | 'revisi_laporan'
            $table->string('judul', 180);
            $table->text('pesan');
            $table->string('nama_pelapor', 150)->nullable();
            $table->string('nim_pelapor', 50)->nullable();
            $table->string('kategori_laporan', 50)->nullable();
            $table->string('lokasi_kampus', 30)->nullable();
            $table->string('lokasi', 255)->nullable();
            $table->date('tanggal_kejadian')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['admin_id', 'is_read', 'id'], 'admin_notifications_admin_read_id_idx');
            $table->index(['admin_id', 'created_at'], 'admin_notifications_admin_created_idx');
            $table->index('id_laporan', 'admin_notifications_laporan_idx');

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

    public function down(): void
    {
        Schema::dropIfExists('admin_notifications');
    }
};

