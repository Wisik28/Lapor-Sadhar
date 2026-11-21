<?php

namespace App\Http\Requests\Laporan;

use App\Models\Laporan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'lokasi_kampus'    => ['sometimes', 'required', 'string', Rule::in(Laporan::CAMPUS_OPTIONS)],
            'lokasi'           => 'sometimes|required|string|max:255',
            'foto'             => ['nullable', Laporan::fotoValidationRule()],
        ];
    }

    public function messages(): array
    {
        return [
            'kategori_laporan.in'              => 'Kategori harus Fasilitas atau Kebersihan.',
            'deskripsi.min'                    => 'Deskripsi minimal 10 karakter.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
            'lokasi_kampus.required'           => 'Lokasi kampus wajib dipilih.',
            'lokasi_kampus.in'                 => 'Lokasi kampus harus Kampus 1, Kampus 2, Kampus 3, atau Kampus 4.',
        ];
    }
}
