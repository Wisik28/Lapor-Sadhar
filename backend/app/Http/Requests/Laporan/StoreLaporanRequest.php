<?php

namespace App\Http\Requests\Laporan;

use Illuminate\Foundation\Http\FormRequest;

/**
 * StoreLaporanRequest - Validasi untuk membuat laporan baru
 */
class StoreLaporanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nim'              => 'required|string|exists:pelapor,nomor_identitas',
            'kategori_laporan' => 'required|string|in:Fasilitas,Kebersihan',
            'deskripsi'        => 'required|string|min:10',
            'tanggal_kejadian' => 'required|date|before_or_equal:today',
            'lokasi'           => 'required|string|max:255',
            'foto'             => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'nim.required'              => 'NIM pelapor wajib diisi.',
            'nim.exists'                => 'Identitas pelapor tidak ditemukan di sistem.',
            'kategori_laporan.required' => 'Kategori laporan wajib dipilih.',
            'kategori_laporan.in'       => 'Kategori harus Fasilitas atau Kebersihan.',
            'deskripsi.required'        => 'Deskripsi masalah wajib diisi.',
            'deskripsi.min'             => 'Deskripsi minimal 10 karakter.',
            'tanggal_kejadian.required' => 'Tanggal kejadian wajib diisi.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
            'lokasi.required'           => 'Lokasi kejadian wajib diisi.',
        ];
    }
}
