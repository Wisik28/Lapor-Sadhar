<?php

namespace Tests\Feature;

use App\Models\Pelapor;
use App\Models\UserMahasiswa;
use App\Models\UserSession;
use App\Services\CloudinaryStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudinaryFotoUploadTest extends TestCase
{
    use RefreshDatabase;

    private const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.cloudinary', [
            'cloud_name' => 'demo-cloud',
            'api_key'    => 'demo-key',
            'api_secret' => 'demo-secret',
            'folder'     => 'lapor-sadhar/laporan',
        ]);
    }

    private function createUserToken(string $nim = '235314077'): string
    {
        Pelapor::create([
            'nomor_identitas' => $nim,
            'tipe_user'       => 'mahasiswa',
        ]);

        UserMahasiswa::create([
            'nim'          => $nim,
            'nama'         => 'Pelapor Cloudinary',
            'password'     => Hash::make('password123'),
            'no_handphone' => '081234567890',
        ]);

        $plainToken = 'cloudinary-user-token-' . $nim;
        UserSession::create([
            'account_type' => 'mahasiswa',
            'account_id'   => $nim,
            'token_hash'   => hash('sha256', $plainToken),
            'expires_at'   => now()->addHour(),
        ]);

        return $plainToken;
    }

    public function test_store_laporan_uploads_single_base64_image_to_cloudinary_and_stores_url_only(): void
    {
        $token = $this->createUserToken('235314071');
        $expectedUrl = 'https://res.cloudinary.com/demo-cloud/image/upload/v1700000001/lapor-sadhar/laporan/foto-1.png';

        Http::fake([
            'https://api.cloudinary.com/v1_1/demo-cloud/image/upload' => Http::response([
                'secure_url' => $expectedUrl,
                'public_id'  => 'lapor-sadhar/laporan/foto-1',
            ], 200),
        ]);

        $dataUri = 'data:image/png;base64,' . self::TINY_PNG_BASE64;

        $response = $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314071',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Proyektor kelas berkedip saat dipakai kuliah.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Ruang Kelas K.205',
            'foto'             => $dataUri,
        ])->assertCreated()
            ->assertJsonPath('data.foto', $expectedUrl);

        $idLaporan = $response->json('data.id_laporan');

        $this->assertDatabaseHas('laporan', [
            'id_laporan' => $idLaporan,
            'foto'       => $expectedUrl,
        ]);

        Http::assertSent(function (HttpClientRequest $request): bool {
            return $request->url() === 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload'
                && $request->isMultipart()
                && str_contains($request->body(), 'demo-key')
                && str_contains($request->body(), 'lapor-sadhar/laporan');
        });
    }

    public function test_store_laporan_uploads_multiple_base64_images_to_cloudinary_and_stores_json_urls(): void
    {
        $token = $this->createUserToken('235314072');
        $url1 = 'https://res.cloudinary.com/demo-cloud/image/upload/v1/lapor-sadhar/laporan/a.png';
        $url2 = 'https://res.cloudinary.com/demo-cloud/image/upload/v2/lapor-sadhar/laporan/b.png';

        Http::fake([
            'https://api.cloudinary.com/v1_1/demo-cloud/image/upload' => Http::sequence()
                ->push(['secure_url' => $url1], 200)
                ->push(['secure_url' => $url2], 200),
        ]);

        $dataUri = 'data:image/png;base64,' . self::TINY_PNG_BASE64;

        $response = $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314072',
            'kategori_laporan' => 'Kebersihan',
            'deskripsi'        => 'Sampah menumpuk di dekat kantin mahasiswa.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 1',
            'lokasi'           => 'Kantin Kampus 1',
            'foto'             => json_encode([$dataUri, $dataUri], JSON_THROW_ON_ERROR),
        ])->assertCreated();

        $expectedJson = json_encode([$url1, $url2], JSON_THROW_ON_ERROR);
        $this->assertSame($expectedJson, $response->json('data.foto'));
        $this->assertDatabaseHas('laporan', [
            'id_laporan' => $response->json('data.id_laporan'),
            'foto'       => $expectedJson,
        ]);

        Http::assertSentCount(2);
    }

    public function test_store_laporan_rejects_invalid_foto_without_calling_cloudinary(): void
    {
        $token = $this->createUserToken('235314073');
        Http::fake();

        $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314073',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kursi ruang seminar patah di bagian sandaran.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 2',
            'lokasi'           => 'Ruang Seminar',
            'foto'             => 'bukan-url-atau-gambar',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('laporan', 0);
        Http::assertNothingSent();
    }

    public function test_store_laporan_supports_uploaded_file_via_multipart_form_data(): void
    {
        $token = $this->createUserToken('235314074');
        $expectedUrl = 'https://res.cloudinary.com/demo-cloud/image/upload/v1/lapor-sadhar/laporan/multipart.png';

        Http::fake([
            'https://api.cloudinary.com/v1_1/demo-cloud/image/upload' => Http::response([
                'secure_url' => $expectedUrl,
            ], 200),
        ]);

        $file = UploadedFile::fake()->createWithContent('bukti.png', base64_decode(self::TINY_PNG_BASE64));

        $response = $this->withToken($token)->post('/api/laporan', [
            'nim'              => '235314074',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Keran air di toilet lantai 1 bocor terus.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 4',
            'lokasi'           => 'Toilet Lantai 1',
            'foto'             => $file,
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame($expectedUrl, $response->json('data.foto'));
    }

    public function test_update_and_delete_laporan_sync_and_cleanup_cloudinary_urls(): void
    {
        $token = $this->createUserToken('235314075');
        $oldUrl = 'https://res.cloudinary.com/demo-cloud/image/upload/v1700000001/lapor-sadhar/laporan/lama.png';
        $newUrl = 'https://res.cloudinary.com/demo-cloud/image/upload/v1700000002/lapor-sadhar/laporan/baru.png';

        Http::fake([
            'https://api.cloudinary.com/v1_1/demo-cloud/image/upload' => Http::sequence()
                ->push(['secure_url' => $oldUrl], 200)
                ->push(['secure_url' => $newUrl], 200),
            'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy' => Http::response(['result' => 'ok'], 200),
        ]);

        $dataUri = 'data:image/png;base64,' . self::TINY_PNG_BASE64;

        $created = $this->withToken($token)->postJson('/api/laporan', [
            'nim'              => '235314075',
            'kategori_laporan' => 'Fasilitas',
            'deskripsi'        => 'Kunci pintu ruang dosen macet dan sulit dibuka.',
            'tanggal_kejadian' => now()->toDateString(),
            'lokasi_kampus'    => 'Kampus 3',
            'lokasi'           => 'Ruang Dosen',
            'foto'             => $dataUri,
        ])->assertCreated();

        $idLaporan = $created->json('data.id_laporan');

        $this->withToken($token)->putJson('/api/laporan/' . $idLaporan, [
            'foto' => $dataUri,
        ])->assertOk()->assertJsonPath('data.foto', $newUrl);

        $this->assertDatabaseHas('laporan', [
            'id_laporan' => $idLaporan,
            'foto'       => $newUrl,
        ]);

        $this->withToken($token)->deleteJson('/api/laporan/' . $idLaporan)->assertOk();

        Http::assertSent(function (HttpClientRequest $request): bool {
            return $request->url() === 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy'
                && $request['public_id'] === 'lapor-sadhar/laporan/lama';
        });
        Http::assertSent(function (HttpClientRequest $request): bool {
            return $request->url() === 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy'
                && $request['public_id'] === 'lapor-sadhar/laporan/baru';
        });
    }

    public function test_cloudinary_signature_and_public_id_extraction_follow_cloudinary_spec(): void
    {
        $service = new CloudinaryStorageService();

        $signature = $service->generateSignature([
            'timestamp' => '1700000000',
            'folder'    => 'lapor-sadhar/laporan',
            'public_id' => 'sample-id',
        ], 'my_secret');

        $this->assertSame(
            sha1('folder=lapor-sadhar/laporan&public_id=sample-id&timestamp=1700000000my_secret'),
            $signature
        );

        $this->assertSame(
            'lapor-sadhar/laporan/sample-id',
            $service->extractPublicIdFromUrl(
                'https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/lapor-sadhar/laporan/sample-id.jpg',
                'demo-cloud'
            )
        );
    }
}

