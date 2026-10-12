<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_mahasiswa', function (Blueprint $table) {
            if (!Schema::hasColumn('user_mahasiswa', 'tipe_user')) {
                $table->string('tipe_user')->default('mahasiswa')->after('no_handphone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_mahasiswa', function (Blueprint $table) {
            if (Schema::hasColumn('user_mahasiswa', 'tipe_user')) {
                $table->dropColumn('tipe_user');
            }
        });
    }
};
