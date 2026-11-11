<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Bobot Dimensi Penilaian Prioritas
    |--------------------------------------------------------------------------
    | Rumus deterministik perhitungan skor prioritas (0-100) per kategori:
    | - fasilitas: safety_risk (30%), damage_level (25%), operational_impact (20%),
    |   location_weight (10%), duplicate_factor (10%), aging_factor (5%).
    | - kebersihan: health_risk (30%), volume_area (25%), pollution_type (15%),
    |   location_weight (15%), duplicate_factor (10%), aging_factor (5%).
    */
    'weights' => [
        'fasilitas' => [
            'safety_risk'        => 0.30,
            'damage_level'       => 0.25,
            'operational_impact' => 0.20,
            'location_weight'    => 0.10,
            'duplicate_factor'   => 0.10,
            'aging_factor'       => 0.05,
        ],
        'kebersihan' => [
            'health_risk'      => 0.30,
            'volume_area'      => 0.25,
            'pollution_type'   => 0.15,
            'location_weight'  => 0.15,
            'duplicate_factor' => 0.10,
            'aging_factor'     => 0.05,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Bobot Dasar Tingkat Kerusakan (Dokumen Deskripsi Bagian 6.2)
    |--------------------------------------------------------------------------
    | Berat: Membahayakan keselamatan / operasional kampus (100)
    | Sedang: Mengganggu kenyamanan / sebagian fungsi (50)
    | Ringan: Tidak mengganggu fungsi utama / kosmetik (20)
    */
    'severity_base_scores' => [
        'berat'  => 100,
        'sedang' => 50,
        'ringan' => 20,
    ],

    /*
    |--------------------------------------------------------------------------
    | Rentang Level Skor Prioritas
    |--------------------------------------------------------------------------
    */
    'levels' => [
        'kritis' => ['min' => 81, 'max' => 100, 'label' => 'Kritis'],
        'tinggi' => ['min' => 61, 'max' => 80,  'label' => 'Tinggi'],
        'sedang' => ['min' => 31, 'max' => 60,  'label' => 'Sedang'],
        'rendah' => ['min' => 0,  'max' => 30,  'label' => 'Rendah'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Safety Override Threshold
    |--------------------------------------------------------------------------
    | Bila safety_flags terdeteksi, skor dipaksa minimal bernilai 81 (kritis).
    */
    'safety_override_min_score' => 81,

    /*
    |--------------------------------------------------------------------------
    | Bobot Lokasi Strategis
    |--------------------------------------------------------------------------
    */
    'location_weights' => [
        'laboratorium'   => 1.0,
        'jalur_evakuasi' => 1.0,
        'ruang_kuliah'   => 0.9,
        'kelas'          => 0.9,
        'toilet'         => 0.8,
        'perpustakaan'   => 0.8,
        'kantin'         => 0.8,
        'kantor'         => 0.6,
        'koridor'        => 0.6,
        'parkir'         => 0.4,
        'area_luar'      => 0.3,
        'default'        => 0.4,
    ],

    /*
    |--------------------------------------------------------------------------
    | Parameter Penuaan (Aging) dan Duplikat
    |--------------------------------------------------------------------------
    */
    'aging_max_days'      => 14,
    'duplicate_max_count' => 5,
];

