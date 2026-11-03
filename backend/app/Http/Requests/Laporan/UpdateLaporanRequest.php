<?php

namespace App\Http\Requests\Laporan;

use Illuminate\Foundation\Http\FormRequest;

/**
 * UpdateLaporanRequest - Validasi untuk mengubah laporan
 */
class UpdateLaporanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kategori_laporan' => 'sometimes|required|string|in:Fasilitas,Kebersihan',
            'deskripsi'        => 'sometimes|required|string|min:10',
            'tanggal_kejadian' => 'sometimes|required|date|before_or_equal:today',
            'lokasi'           => 'sometimes|required|string|max:255',
            'foto'             => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'kategori_laporan.in'              => 'Kategori harus Fasilitas atau Kebersihan.',
            'deskripsi.min'                    => 'Deskripsi minimal 10 karakter.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
        ];
    }
}
