<?php

namespace App\Services\Priority;

/**
 * Normalisasi dan pencocokan ketat detail lokasi/ruangan untuk Tahap 1 Pre-filter lokal.
 */
class LocationDetailNormalizer
{
    /**
     * Normalisasi string lokasi: case-insensitive, trim, hapus prefix kampus,
     * seragamkan singkatan ruangan/gedung, dan rapikan spasi.
     */
    public function normalize(?string $lokasi): string
    {
        if ($lokasi === null) {
            return '';
        }

        $raw = mb_strtolower(trim($lokasi), 'UTF-8');
        if ($raw === '') {
            return '';
        }

        // Hapus prefix kampus di awal (mis. "Kampus III Paingan, Ruang 204" -> "ruang 204")
        $stripped = preg_replace(
            '/^kampus\s*(?:iv|iii|ii|i|[1-4])(?:\s+(?:mrican|paingan|kotabaru|kentungan))?\s*(?:[,:\-\|\/]\s*|\s+)/u',
            '',
            $raw
        );
        $text = is_string($stripped) && trim($stripped) !== '' ? trim($stripped) : $raw;

        // Seragamkan singkatan umum lokasi kampus
        $replacements = [
            '/\blaboratorium\b/u' => 'lab',
            '/\blab\.?\s*/u'      => 'lab ',
            '/\bruangan\b/u'      => 'ruang',
            '/\brg\.?\s*/u'       => 'ruang ',
            '/\br\.\s*/u'         => 'ruang ',
            '/\blt\.?\s*/u'       => 'lantai ',
            '/\bgdg\.?\s*/u'      => 'gedung ',
            '/\bgd\.?\s*/u'       => 'gedung ',
            '/\bkls\.?\s*/u'      => 'kelas ',
        ];

        foreach ($replacements as $pattern => $replacement) {
            $replaced = preg_replace($pattern, $replacement, $text);
            if (is_string($replaced)) {
                $text = $replaced;
            }
        }

        // Gabungkan kode ruangan 1 huruf + pemisah + angka (mis. "k.204", "k-204", "k 204" -> "k204")
        $mergedRoomCode = preg_replace('/\b([a-z])[\.\-\s]+(\d+)\b/u', '$1$2', $text);
        if (is_string($mergedRoomCode)) {
            $text = $mergedRoomCode;
        }

        // Hilangkan tanda baca menjadi spasi dan rapikan spasi berlebih
        $cleaned = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text);
        $collapsed = preg_replace('/\s+/u', ' ', is_string($cleaned) ? $cleaned : $text);

        return trim(is_string($collapsed) ? $collapsed : $text);
    }

    /**
     * Periksa apakah dua detail lokasi merujuk pada ruangan/titik yang sama secara ketat.
     * Menolak kecocokan bila kedua detail memiliki nomor ruangan/lantai yang berbeda
     * (mis. "Ruang Kelas 204" vs "Ruang Kelas 205").
     */
    public function isMatch(?string $lokasiA, ?string $lokasiB): bool
    {
        $normA = $this->normalize($lokasiA);
        $normB = $this->normalize($lokasiB);

        if ($normA === '' || $normB === '') {
            return false;
        }

        if ($normA === $normB) {
            return true;
        }

        // Nomor ruangan / lantai harus cocok persis bila salah satu atau keduanya bernomor
        $numsA = $this->extractNumbers($normA);
        $numsB = $this->extractNumbers($normB);
        if (($numsA !== [] || $numsB !== []) && $numsA !== $numsB) {
            return false;
        }

        // Kemiripan string ketat
        similar_text($normA, $normB, $percent);
        if ($percent >= 85.0) {
            return true;
        }

        // Kemiripan token ketat (Jaccard >= 0.75)
        $tokensA = array_values(array_unique(array_filter(explode(' ', $normA))));
        $tokensB = array_values(array_unique(array_filter(explode(' ', $normB))));

        if ($tokensA === [] || $tokensB === []) {
            return false;
        }

        $intersection = count(array_intersect($tokensA, $tokensB));
        $union = count(array_unique(array_merge($tokensA, $tokensB)));

        return $union > 0 && ($intersection / $union) >= 0.75;
    }

    /**
     * Ekstrak seluruh himpunan angka unik terurut dari teks ternormalisasi.
     *
     * @return array<int, string>
     */
    private function extractNumbers(string $normalizedText): array
    {
        preg_match_all('/\d+/u', $normalizedText, $matches);
        $numbers = array_values(array_unique($matches[0] ?? []));
        sort($numbers);

        return $numbers;
    }
}

