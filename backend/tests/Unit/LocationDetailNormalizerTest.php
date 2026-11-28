<?php

namespace Tests\Unit;

use App\Services\Priority\LocationDetailNormalizer;
use PHPUnit\Framework\TestCase;

class LocationDetailNormalizerTest extends TestCase
{
    private LocationDetailNormalizer $normalizer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalizer = new LocationDetailNormalizer();
    }

    public function test_normalizes_campus_prefix_case_whitespace_and_abbreviations(): void
    {
        $this->assertSame(
            'ruang kelas 204',
            $this->normalizer->normalize('  Kampus III Paingan,   Ruang Kelas 204  ')
        );
        $this->assertSame(
            'ruang 203',
            $this->normalizer->normalize('Kampus 1, R. 203')
        );
        $this->assertSame(
            'lab komputer 1',
            $this->normalizer->normalize('Kampus III, Laboratorium Komputer 1')
        );
        $this->assertSame(
            'toilet lantai 2 gedung b',
            $this->normalizer->normalize('Kampus II, Toilet Lt. 2 Gd. B')
        );
    }

    public function test_matches_equivalent_location_details_strictly(): void
    {
        $this->assertTrue($this->normalizer->isMatch(
            'Kampus III, Ruang Kelas 204',
            'kampus 3,  ruang kelas 204 '
        ));
        $this->assertTrue($this->normalizer->isMatch(
            'Kampus I, R. 203',
            'Kampus 1, Ruangan 203'
        ));
        $this->assertTrue($this->normalizer->isMatch(
            'Kampus III, Lab. Komputer 1',
            'Kampus 3, Laboratorium Komputer 1'
        ));
        $this->assertTrue($this->normalizer->isMatch(
            'Kampus I, Toilet Lt. 2 Gedung B',
            'Kampus 1, Toilet Lantai 2 Gd. B'
        ));
    }

    public function test_rejects_different_room_numbers_or_unrelated_locations(): void
    {
        $this->assertFalse($this->normalizer->isMatch(
            'Kampus III, Ruang Kelas 204',
            'Kampus III, Ruang Kelas 205'
        ));
        $this->assertFalse($this->normalizer->isMatch(
            'Kampus I, Toilet Lt. 2 Gedung B',
            'Kampus I, Toilet Lt. 3 Gedung B'
        ));
        $this->assertFalse($this->normalizer->isMatch(
            'Kampus III, Ruang Kelas 204',
            'Kampus III, Ruang Kelas'
        ));
        $this->assertFalse($this->normalizer->isMatch(
            'Kampus I, Toilet Utama',
            'Kampus I, Lapangan Basket'
        ));
    }
}

