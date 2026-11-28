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
    | Kategori Lokasi, Tingkat Keparahan Awal (Skala 1-4), dan Bobot Prioritas
    |--------------------------------------------------------------------------
    | Skala Keparahan:
    | - Rendah (1)
    | - Sedang (2)
    | - Tinggi (3)
    | - Sangat Tinggi (4)
    */
    'location_severity_scale' => [
        'Rendah'        => 1,
        'Sedang'        => 2,
        'Tinggi'        => 3,
        'Sangat Tinggi' => 4,
    ],

    'location_categories' => [
        'Laboratorium Praktik' => [
            'severity_label'  => 'Sangat Tinggi',
            'severity_score'  => 4,
            'location_weight' => 1.00,
        ],
        'Ruang Kelas' => [
            'severity_label'  => 'Tinggi',
            'severity_score'  => 3,
            'location_weight' => 0.90,
        ],
        'Toilet' => [
            'severity_label'  => 'Tinggi',
            'severity_score'  => 3,
            'location_weight' => 0.80,
        ],
        'Parkiran' => [
            'severity_label'  => 'Tinggi',
            'severity_score'  => 3,
            'location_weight' => 0.75,
        ],
        'Ruang Dosen' => [
            'severity_label'  => 'Sedang',
            'severity_score'  => 2,
            'location_weight' => 0.60,
        ],
        'Perpustakaan' => [
            'severity_label'  => 'Sedang',
            'severity_score'  => 2,
            'location_weight' => 0.60,
        ],
        'Lapangan' => [
            'severity_label'  => 'Sedang',
            'severity_score'  => 2,
            'location_weight' => 0.50,
        ],
        'Ruang Terbuka' => [
            'severity_label'  => 'Rendah',
            'severity_score'  => 1,
            'location_weight' => 0.25,
        ],
        'Tidak Diketahui' => [
            'severity_label'  => 'Sedang',
            'severity_score'  => 2,
            'location_weight' => 0.50,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Bobot Lokasi Strategis (Legacy Mapping)
    |--------------------------------------------------------------------------
    */
    'location_weights' => [
        'laboratorium'   => 1.0,
        'jalur_evakuasi' => 1.0,
        'ruang_kuliah'   => 0.9,
        'kelas'          => 0.9,
        'toilet'         => 0.8,
        'perpustakaan'   => 0.6,
        'kantin'         => 0.8,
        'kantor'         => 0.6,
        'koridor'        => 0.25,
        'parkir'         => 0.75,
        'area_luar'      => 0.25,
        'default'        => 0.5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Parameter Penuaan (Aging) dan Duplikat
    |--------------------------------------------------------------------------
    */
    'aging_max_days'      => 14,
    'duplicate_max_count' => 5,

    /*
    |--------------------------------------------------------------------------
    | Aturan Eskalasi Otomatis untuk Grup Laporan Serupa
    |--------------------------------------------------------------------------
    | Jika jumlah pelapor unik dalam satu grup mencapai minimal 3 pelapor
    | berbeda, seluruh laporan dalam grup dinaikkan ke prioritas tertinggi.
    */
    'group_escalation' => [
        'min_unique_reporters' => 3,
        'score'                => 100,
        'priority_level'       => 'kritis',
        'severity_level'       => 'berat',
    ],
];

