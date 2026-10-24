<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pelapor', function (Blueprint $table) {
            $table->string('nomor_identitas')->primary();
            $table->string('tipe_user');
            $table->timestamps();
        });

        DB::table('user_mahasiswa')->orderBy('nim')->chunk(100, function ($users): void {
            $pelaporRows = [];

            foreach ($users as $user) {
                $pelaporRows[] = [
                    'nomor_identitas' => $user->nim,
                    'tipe_user' => ($user->tipe_user ?? 'mahasiswa') === 'karyawan' ? 'karyawan' : 'mahasiswa',
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ];
            }

            DB::table('pelapor')->insert($pelaporRows);
        });

        Schema::create('user_pegawai', function (Blueprint $table) {
            $table->string('nomor_identitas')->primary();
            $table->string('nama');
            $table->string('password');
            $table->string('no_handphone');
            $table->timestamps();
            $table->foreign('nomor_identitas')->references('nomor_identitas')->on('pelapor')->cascadeOnDelete()->cascadeOnUpdate();
        });

        DB::table('user_mahasiswa')
            ->where('tipe_user', 'karyawan')
            ->orderBy('nim')
            ->chunk(100, function ($users): void {
                $pegawaiRows = [];

                foreach ($users as $user) {
                    $pegawaiRows[] = [
                        'nomor_identitas' => $user->nim,
                        'nama' => $user->nama,
                        'password' => $user->password,
                        'no_handphone' => $user->no_handphone,
                        'created_at' => $user->created_at,
                        'updated_at' => $user->updated_at,
                    ];
                }

                DB::table('user_pegawai')->insert($pegawaiRows);
            });

        Schema::table('laporan', function (Blueprint $table) {
            $table->dropForeign(['nim']);
        });

        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->foreign('nim')->references('nomor_identitas')->on('pelapor')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::table('laporan', function (Blueprint $table) {
            $table->foreign('nim')->references('nomor_identitas')->on('pelapor')->cascadeOnDelete()->cascadeOnUpdate();
        });

        DB::table('user_mahasiswa')->where('tipe_user', 'karyawan')->delete();

        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->dropColumn('tipe_user');
        });
    }

    public function down(): void
    {
        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->string('tipe_user')->default('mahasiswa');
        });

        DB::table('user_pegawai')->orderBy('nomor_identitas')->chunk(100, function ($users): void {
            $mahasiswaRows = [];

            foreach ($users as $user) {
                $mahasiswaRows[] = [
                    'nim' => $user->nomor_identitas,
                    'nama' => $user->nama,
                    'password' => $user->password,
                    'no_handphone' => $user->no_handphone,
                    'tipe_user' => 'karyawan',
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ];
            }

            DB::table('user_mahasiswa')->insert($mahasiswaRows);
        });

        Schema::table('user_mahasiswa', function (Blueprint $table) {
            $table->dropForeign(['nim']);
        });

        Schema::table('laporan', function (Blueprint $table) {
            $table->dropForeign(['nim']);
        });

        Schema::table('laporan', function (Blueprint $table) {
            $table->foreign('nim')->references('nim')->on('user_mahasiswa')->cascadeOnDelete()->cascadeOnUpdate();
        });

        Schema::dropIfExists('user_pegawai');
        Schema::dropIfExists('pelapor');
    }
};
