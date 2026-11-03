<?php

namespace App\Http\Requests\Laporan;

use Illuminate\Foundation\Http\FormRequest;

/**
 * UpdateStatusLaporanRequest - Validasi untuk mengubah status laporan (admin)
 */
class UpdateStatusLaporanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status_laporan' => [
                'required',
                'string',
                'in:Terkirim,Diverifikasi,Diproses,Selesai,Ditolak'
            ],
            'pesan_tanggapan' => 'nullable|string|max:2000',
        ];
    }

    public function messages(): array
    {
        return [
            'status_laporan.required' => 'Status laporan wajib diisi.',
            'status_laporan.in'       => 'Status harus salah satu dari: Terkirim, Diverifikasi, Diproses, Selesai, Ditolak.',
            'pesan_tanggapan.max'     => 'Pesan tanggapan maksimal 2000 karakter.',
        ];
    }
}
