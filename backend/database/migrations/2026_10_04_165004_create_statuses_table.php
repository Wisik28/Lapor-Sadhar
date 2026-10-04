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
        Schema::create('status', function (Blueprint $table) {
            $table->id('id_status');
            $table->unsignedBigInteger('id_laporan');
            $table->foreign('id_laporan')->references('id_laporan')->on('laporan')->onDelete('cascade')->onUpdate('cascade');
            $table->string('status_laporan');
            $table->timestamp('tanggal_merubah')->useCurrent();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('status');
    }
};
