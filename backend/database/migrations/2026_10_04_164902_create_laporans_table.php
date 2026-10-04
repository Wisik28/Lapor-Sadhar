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
        Schema::create('laporan', function (Blueprint $table) {
            $table->id('id_laporan');
            $table->string('nim');
            $table->foreign('nim')->references('nim')->on('user_mahasiswa')->onDelete('cascade')->onUpdate('cascade');
            $table->string('kategori_laporan');
            $table->timestamp('tanggal_buat')->useCurrent();
            $table->text('deskripsi');
            $table->string('foto')->nullable();
            $table->dateTime('tanggal_kejadian');
            $table->string('lokasi');
            $table->timestamp('tanggal_rubah')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('laporan');
    }
};
