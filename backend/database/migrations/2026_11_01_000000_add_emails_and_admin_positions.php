<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
            $table->string('jabatan')->nullable();
        });

        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
        });

        Schema::table('user_pegawai', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('user_pegawai', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn('email');
        });

        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn('email');
        });

        Schema::table('admin', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn(['email', 'jabatan']);
        });
    }
};
