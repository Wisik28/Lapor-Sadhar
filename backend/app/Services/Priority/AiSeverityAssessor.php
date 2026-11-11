<?php

namespace App\Services\Priority;

class AiSeverityAssessor
{
    /**
     * Pola kata kunci untuk deteksi upaya injeksi instruksi / prompt injection
     */
    private const INJECTION_PATTERNS = [
        '/abaikan\s+instruksi/i',
        '/anggap\s+ini\s+kritis/i',
        '/ignore\s+(?:previous|above|all)\s+instructions/i',
        '/prioritaskan\s+tinggi/i',
        '/wajib\s+kritis/i',
        '/system\s*:\s*/i',
    ];

    /**
     * Pola bahaya keselamatan mendesak (Safety Flags)
     */
    private const SAFETY_FLAG_PATTERNS = [
        'kabel_listrik_terbuka' => ['kabel terbuka', 'kabel terkelupas', 'korsleting', 'tersengat', 'tersetrum', 'percikan api', 'stop kontak berasap'],
        'risiko_runtuh'         => ['atap ambruk', 'runtuh', 'plafon jebol', 'plafon runtuh', 'roboh', 'tembok retak besar', 'pecahan kaca', 'kaca pecah'],
        'api_atau_asap'         => ['kebakaran', 'asap tebal', 'terbakar', 'api menyala', 'bau hangus menyengat'],
        'kebocoran_gas'         => ['bau gas menyengat', 'bocor gas', 'tabung gas bocor'],
        'limbah_kimia_b3'       => ['limbah kimia', 'limbah b3', 'cairan beracun', 'zat kimia tumpah', 'limbah medis'],
    ];

    /**
     * Kata kunci kerusakan tingkat berat (Fasilitas)
     */
    private const FASILITAS_BERAT_KEYWORDS = [
        'atap bocor deras', 'bocor parah', 'banjir', 'ambruk', 'jebol', 'tidak bisa digunakan sama sekali',
        'mati total', 'lift macet', 'terjebak', 'laboratorium tidak bisa dipakai', 'kabel terbuka',
        'korsleting', 'kebakaran', 'runtuh', 'bahaya', 'saluran air pecah'
    ];

    /**
     * Kata kunci kerusakan tingkat sedang (Fasilitas)
     */
    private const FASILITAS_SEDANG_KEYWORDS = [
        'ac mati', 'ac rusak', 'ac panas', 'lampu mati', 'lampu padam', 'proyektor mati',
        'proyektor rusak', 'pintu rusak', 'pintu macet', 'jendela rusak', 'wastafel mampet',
        'kran bocor', 'toilet rusak', 'kursi rusak', 'meja rusak', 'kipas mati', 'kunci pintu rusak'
    ];

    /**
     * Kata kunci kerusakan tingkat berat (Kebersihan)
     */
    private const KEBERSIHAN_BERAT_KEYWORDS = [
        'limbah b3', 'limbah kimia', 'bangkai', 'toilet meluap', 'kotoran meluap',
        'air limbah membanjiri', 'sampah menggunung menutupi akses', 'bau busuk sangat menyengat',
        'sarang tawon', 'sarang lebah', 'ulat', 'belatung'
    ];

    /**
     * Kata kunci kerusakan tingkat sedang (Kebersihan)
     */
    private const KEBERSIHAN_SEDANG_KEYWORDS = [
        'sampah menumpuk', 'sampah berserakan', 'toilet kotor', 'bau menyengat',
        'saluran tersumbat', 'genangan air', 'lantai licin dan kotor', 'wastafel kotor',
        'tempat sampah penuh meluber'
    ];

    /**
     * Lakukan analisis laporan dan usulkan penilaian tingkat kerusakan & sinyal dimensi.
     *
     * @param string $kategori 'Fasilitas' | 'Kebersihan'
     * @param string $deskripsi
     * @param string $lokasi
     * @param bool   $hasPhoto
     * @return array
     */
    public function assess(string $kategori, string $deskripsi, string $lokasi = '', bool $hasPhoto = false): array
    {
        $descLower = strtolower($deskripsi);
        $reasons = [];
        $safetyFlags = [];
        $needsReview = true; // Usulan AI selalu menandai perlu konfirmasi hingga admin menetapkan
        $confidence = 0.82;

        // 1. Deteksi upaya manipulasi instruksi (Prompt Injection Protection)
        $injectionDetected = false;
        foreach (self::INJECTION_PATTERNS as $pattern) {
            if (preg_match($pattern, $deskripsi)) {
                $injectionDetected = true;
                break;
            }
        }

        if ($injectionDetected) {
            $reasons[] = 'Deskripsi mengandung pola kalimat instruksi/manipulasi prioritas.';
            $confidence = min($confidence, 0.45);
        }

        // 2. Deteksi Safety Flags
        foreach (self::SAFETY_FLAG_PATTERNS as $flag => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($descLower, $kw)) {
                    $safetyFlags[] = $flag;
                    break;
                }
            }
        }

        $isFasilitas = strcasecmp($kategori, 'fasilitas') === 0;

        if ($isFasilitas) {
            $result = $this->assessFasilitas($descLower, $safetyFlags, $hasPhoto, $lokasi);
        } else {
            $result = $this->assessKebersihan($descLower, $safetyFlags, $hasPhoto, $lokasi);
        }

        // Gabungkan alasan
        $allReasons = array_merge($reasons, $result['reasons']);
        if (count($safetyFlags) > 0) {
            $allReasons[] = 'Terdeteksi sinyal bahaya keselamatan (' . implode(', ', $safetyFlags) . ').';
        }

        return [
            'subcategory'            => $result['subcategory'],
            'suggested_severity'     => $result['severity'],
            'dimensions'             => $result['dimensions'],
            'safety_flags'           => array_values(array_unique($safetyFlags)),
            'confidence'             => $injectionDetected ? 0.45 : $confidence,
            'reasons'                => array_slice($allReasons, 0, 4),
            'needs_review'           => true, // Tetap ditandai 'perlu dikonfirmasi'
            'photo_relevant'         => true,
            'photo_text_consistent'  => true,
            'source'                 => 'ai',
        ];
    }

    private function assessFasilitas(string $text, array $safetyFlags, bool $hasPhoto, string $lokasi): array
    {
        $hasBeratKeyword = false;
        foreach (self::FASILITAS_BERAT_KEYWORDS as $kw) {
            if (str_contains($text, $kw)) {
                $hasBeratKeyword = true;
                break;
            }
        }

        $hasSedangKeyword = false;
        foreach (self::FASILITAS_SEDANG_KEYWORDS as $kw) {
            if (str_contains($text, $kw)) {
                $hasSedangKeyword = true;
                break;
            }
        }

        if (count($safetyFlags) > 0 || $hasBeratKeyword) {
            $severity = 'berat';
            $dimensions = [
                'safety_risk'        => count($safetyFlags) > 0 ? 0.95 : 0.85,
                'damage_level'       => 0.85,
                'operational_impact' => 0.85,
            ];
            $reasons = [
                'Terindikasi kerusakan fasilitas berat yang berpotensi membahayakan keselamatan atau menghentikan aktivitas kampus.',
            ];
            $subcategory = count($safetyFlags) > 0 ? 'kelistrikan' : 'atap_plafon';
        } elseif ($hasSedangKeyword) {
            $severity = 'sedang';
            $dimensions = [
                'safety_risk'        => 0.25,
                'damage_level'       => 0.55,
                'operational_impact' => 0.55,
            ];
            $reasons = [
                'Kerusakan fasilitas sedang yang mengganggu kenyamanan atau sebagian fungsi operasional.',
            ];
            $subcategory = 'perabot_peralatan';
        } else {
            $severity = 'ringan';
            $dimensions = [
                'safety_risk'        => 0.10,
                'damage_level'       => 0.25,
                'operational_impact' => 0.20,
            ];
            $reasons = [
                'Kerusakan minor/kosmetik yang belum mengganggu kelancaran kegiatan utama.',
            ];
            $subcategory = 'lainnya';
        }

        return [
            'severity'    => $severity,
            'dimensions'  => $dimensions,
            'reasons'     => $reasons,
            'subcategory' => $subcategory,
        ];
    }

    private function assessKebersihan(string $text, array $safetyFlags, bool $hasPhoto, string $lokasi): array
    {
        $hasBeratKeyword = false;
        foreach (self::KEBERSIHAN_BERAT_KEYWORDS as $kw) {
            if (str_contains($text, $kw)) {
                $hasBeratKeyword = true;
                break;
            }
        }

        $hasSedangKeyword = false;
        foreach (self::KEBERSIHAN_SEDANG_KEYWORDS as $kw) {
            if (str_contains($text, $kw)) {
                $hasSedangKeyword = true;
                break;
            }
        }

        if (count($safetyFlags) > 0 || $hasBeratKeyword) {
            $severity = 'berat';
            $dimensions = [
                'health_risk'    => 0.90,
                'volume_area'    => 0.85,
                'pollution_type' => 0.85,
            ];
            $reasons = [
                'Kondisi kebersihan berisiko kesehatan tinggi atau mencemari area penting kampus.',
            ];
            $subcategory = 'limbah_kimia_b3';
        } elseif ($hasSedangKeyword) {
            $severity = 'sedang';
            $dimensions = [
                'health_risk'    => 0.55,
                'volume_area'    => 0.50,
                'pollution_type' => 0.50,
            ];
            $reasons = [
                'Penumpukan kotoran/sampah sedang yang mengganggu kebersihan dan kenyamanan lingkungan.',
            ];
            $subcategory = 'sampah_menumpuk';
        } else {
            $severity = 'ringan';
            $dimensions = [
                'health_risk'    => 0.20,
                'volume_area'    => 0.20,
                'pollution_type' => 0.20,
            ];
            $reasons = [
                'Kebersihan ringan yang dapat ditangani dalam jadwal pembersihan rutin.',
            ];
            $subcategory = 'area_kotor_umum';
        }

        return [
            'severity'    => $severity,
            'dimensions'  => $dimensions,
            'reasons'     => $reasons,
            'subcategory' => $subcategory,
        ];
    }
}

