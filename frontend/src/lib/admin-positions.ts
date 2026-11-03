export const adminPositions = [
  { value: "wakil_rektor_ii", label: "Wakil Rektor II" },
  { value: "kepala_blu", label: "Kepala Biro Layanan Umum" },
  { value: "kepala_bps", label: "Kepala Biro Sarana dan Prasarana" },
  { value: "kepala_bagian_blu_1", label: "Kepala Bagian BLU 1" },
  { value: "kepala_bagian_blu_2", label: "Kepala Bagian BLU 2" },
  { value: "kepala_bagian_blu_3", label: "Kepala Bagian BLU 3" },
  { value: "kepala_bagian_blu_4", label: "Kepala Bagian BLU 4" },
  { value: "kepala_bagian_bps_1", label: "Kepala Bagian BPS 1" },
  { value: "kepala_bagian_bps_2", label: "Kepala Bagian BPS 2" },
  { value: "kepala_bagian_bps_3", label: "Kepala Bagian BPS 3" },
  { value: "kepala_bagian_bps_4", label: "Kepala Bagian BPS 4" },
] as const;

export type AdminPosition = (typeof adminPositions)[number]["value"];
