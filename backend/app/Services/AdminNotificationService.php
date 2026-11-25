<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\AdminNotification;
use App\Models\Laporan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AdminNotificationService
{
    public function hasTable(): bool
    {
        try {
            return Schema::hasTable('admin_notifications');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Buat notifikasi untuk semua admin yang berwenang melihat laporan baru ini.
     */
    public function notifyNewLaporan(Laporan $laporan): int
    {
        return $this->notifyEligibleAdmins(
            $laporan,
            AdminNotification::TYPE_NEW_REPORT,
            []
        );
    }

    /**
     * Buat notifikasi untuk semua admin yang berwenang ketika pelapor merevisi pengajuan laporan.
     *
     * @param  array<int, string>  $changedFields
     */
    public function notifyRevisedLaporan(Laporan $laporan, array $changedFields = []): int
    {
        return $this->notifyEligibleAdmins(
            $laporan,
            AdminNotification::TYPE_REVISED_REPORT,
            $changedFields
        );
    }

    /**
     * @param  array<int, string>  $changedFields
     */
    private function notifyEligibleAdmins(
        Laporan $laporan,
        string $jenisAktivitas,
        array $changedFields
    ): int {
        if (! $this->hasTable()) {
            return 0;
        }

        $laporan->loadMissing(['pelapor.mahasiswa', 'pelapor.pegawai']);

        $eligibleAdmins = Admin::query()
            ->get()
            ->filter(fn (Admin $admin) => $admin->canAccessLaporan($laporan));

        if ($eligibleAdmins->isEmpty()) {
            return 0;
        }

        $formattedId = str_pad((string) $laporan->id_laporan, 3, '0', STR_PAD_LEFT);
        $namaPelapor = $laporan->nama_pelapor ?: ($laporan->nim ? "Pelapor ({$laporan->nim})" : 'Civitas USD');
        $ringkasanDeskripsi = Str::limit(trim((string) $laporan->deskripsi), 160);

        if ($jenisAktivitas === AdminNotification::TYPE_REVISED_REPORT) {
            $judul = "Revisi Laporan #{$formattedId}";
            $pesan = $this->buildRevisionMessage($changedFields, $ringkasanDeskripsi);
        } else {
            $judul = "Laporan Baru #{$formattedId}";
            $pesan = $ringkasanDeskripsi !== ''
                ? $ringkasanDeskripsi
                : 'Pelapor mengirimkan laporan pengaduan baru.';
        }

        $now = now();
        $tanggalKejadian = $laporan->tanggal_kejadian
            ? substr((string) $laporan->tanggal_kejadian, 0, 10)
            : null;

        $rows = [];
        foreach ($eligibleAdmins as $admin) {
            $rows[] = [
                'admin_id'         => $admin->admin_id,
                'id_laporan'       => $laporan->id_laporan,
                'jenis_aktivitas'  => $jenisAktivitas,
                'judul'            => $judul,
                'pesan'            => $pesan,
                'nama_pelapor'     => $namaPelapor,
                'nim_pelapor'      => $laporan->nim,
                'kategori_laporan' => $laporan->kategori_laporan,
                'lokasi_kampus'    => $laporan->lokasi_kampus,
                'lokasi'           => $laporan->lokasi,
                'tanggal_kejadian' => $tanggalKejadian,
                'is_read'          => false,
                'read_at'          => null,
                'created_at'       => $now,
                'updated_at'       => $now,
            ];
        }

        AdminNotification::insert($rows);

        return count($rows);
    }

    /**
     * @param  array<int, string>  $changedFields
     */
    private function buildRevisionMessage(array $changedFields, string $ringkasanDeskripsi): string
    {
        $fields = array_values(array_unique(array_filter($changedFields)));

        if (count($fields) === 1) {
            $prefix = "Perubahan pada {$fields[0]}";
        } elseif (count($fields) > 1) {
            $last = array_pop($fields);
            $prefix = 'Perubahan pada ' . implode(', ', $fields) . " & {$last}";
        } else {
            $prefix = 'Pelapor memperbarui detail pengajuan';
        }

        return $ringkasanDeskripsi !== ''
            ? "{$prefix}: {$ringkasanDeskripsi}"
            : "{$prefix}.";
    }
}

