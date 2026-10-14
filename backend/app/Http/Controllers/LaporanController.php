<?php

namespace App\Http\Controllers;

use App\Models\Laporan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

class LaporanController extends Controller
{
    /**
     * Kirim laporan baru ke database.
     * Foto di-upload ke Cloudinary; hanya URL yang disimpan di DB.
     *
     * Fields yang diharapkan (multipart/form-data):
     *   - nim             : string, wajib
     *   - kategori_laporan: string, wajib
     *   - tanggal_kejadian: date (Y-m-d), wajib, tidak boleh lebih dari hari ini
     *   - lokasi          : string, wajib
     *   - deskripsi       : string, wajib
     *   - foto[]          : file (image), opsional, maks 5 file, maks 5 MB/file
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nim'              => 'required|string|max:50',
            'kategori_laporan' => 'required|string|max:255',
            'tanggal_kejadian' => 'required|date|before_or_equal:today',
            'lokasi'           => 'required|string|max:255',
            'deskripsi'        => 'required|string',
            'foto'             => 'nullable|array|max:5',
            'foto.*'           => 'image|mimes:jpg,jpeg,png|max:5120',
        ], [
            'nim.required'                     => 'Nomor identitas (NIM/NIP) wajib disertakan.',
            'kategori_laporan.required'        => 'Kategori laporan wajib dipilih.',
            'tanggal_kejadian.required'        => 'Tanggal kejadian wajib diisi.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melebihi hari ini.',
            'lokasi.required'                  => 'Lokasi kejadian wajib diisi.',
            'deskripsi.required'               => 'Deskripsi laporan wajib diisi.',
            'foto.max'                         => 'Maksimal 5 foto yang dapat dilampirkan.',
            'foto.*.image'                     => 'File yang dilampirkan harus berupa gambar.',
            'foto.*.mimes'                     => 'Format foto harus JPG atau PNG.',
            'foto.*.max'                       => 'Ukuran setiap foto maksimal 5 MB.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            // Upload setiap foto ke Cloudinary dan kumpulkan secure_url-nya
            $fotoUrls = [];

            if ($request->hasFile('foto')) {
                $cloudName = env('CLOUDINARY_CLOUD_NAME');
                $apiKey    = env('CLOUDINARY_API_KEY');
                $apiSecret = env('CLOUDINARY_SECRET_KEY');
                $endpoint  = "https://api.cloudinary.com/v1_1/{$cloudName}/image/upload";

                foreach ($request->file('foto') as $file) {
                    // Buat signature sesuai spesifikasi Cloudinary Signed Upload
                    $timestamp    = time();
                    $folder       = 'laporan';
                    $paramsToSign = "folder={$folder}&timestamp={$timestamp}";
                    $signature    = sha1($paramsToSign . $apiSecret);

                    // Kirim file sebagai multipart ke Cloudinary
                    $response = Http::attach(
                        'file',
                        fopen($file->getRealPath(), 'r'),
                        $file->getClientOriginalName()
                    )->post($endpoint, [
                        'api_key'   => $apiKey,
                        'timestamp' => $timestamp,
                        'signature' => $signature,
                        'folder'    => $folder,
                    ]);

                    if (!$response->successful()) {
                        return response()->json([
                            'status'  => 'error',
                            'message' => 'Gagal mengunggah foto ke Cloudinary: '
                                . ($response->json('error.message') ?? 'Unknown error'),
                        ], 500);
                    }

                    // Ambil URL permanen dari Cloudinary
                    $fotoUrls[] = $response->json('secure_url');
                }
            }

            // Simpan laporan ke database; foto disimpan sebagai JSON array URL
            $laporan = Laporan::create([
                'nim'              => trim($request->nim),
                'kategori_laporan' => trim($request->kategori_laporan),
                'tanggal_kejadian' => $request->tanggal_kejadian,
                'lokasi'           => trim($request->lokasi),
                'deskripsi'        => trim($request->deskripsi),
                'foto'             => !empty($fotoUrls) ? json_encode($fotoUrls) : null,
            ]);

            return response()->json([
                'status'     => 'success',
                'message'    => 'Laporan berhasil dikirim. Terima kasih atas laporan Anda!',
                'id_laporan' => $laporan->id_laporan,
                'foto_urls'  => $fotoUrls,
            ], 201);

        } catch (\Throwable $e) {
            $msg = $e->getMessage();

            if (str_contains($msg, 'could not find driver')) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Driver database belum dimuat. Silakan restart server backend.',
                ], 500);
            }

            if (
                str_contains($msg, 'Unknown host') ||
                str_contains($msg, 'Connection refused') ||
                str_contains($msg, 'password authentication failed')
            ) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Koneksi ke database gagal. Periksa konfigurasi .env backend.',
                ], 500);
            }

            return response()->json([
                'status'  => 'error',
                'message' => 'Terjadi kesalahan server: ' . $e->getMessage(),
            ], 500);
        }
    }
}
