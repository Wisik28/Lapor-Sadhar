export const LOKASI_KAMPUS_OPTIONS = [
  'Kampus 1',
  'Kampus 2',
  'Kampus 3',
  'Kampus 4',
] as const;

export type LokasiKampus = (typeof LOKASI_KAMPUS_OPTIONS)[number];

function inferCampusFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bkampus\s*(?:iv|4)\b/i.test(lower) || lower.includes('kotabaru')) {
    return 'Kampus 4';
  }
  if (/\bkampus\s*(?:iii|3)\b/i.test(lower) || lower.includes('paingan') || lower.includes('drost')) {
    return 'Kampus 3';
  }
  if (/\bkampus\s*(?:ii|2)\b/i.test(lower)) {
    return 'Kampus 2';
  }
  if (/\bkampus\s*(?:i|1)\b/i.test(lower) || lower.includes('mrican')) {
    return 'Kampus 1';
  }
  return null;
}

/**
 * Resolve canonical campus name ("Kampus 1".."Kampus 4") from explicit field or free-text location.
 */
export function resolveLokasiKampus(lokasiKampus?: string | null, lokasi?: string | null): string {
  const explicit = (lokasiKampus ?? '').trim();
  if (explicit) {
    if ((LOKASI_KAMPUS_OPTIONS as readonly string[]).includes(explicit)) {
      return explicit;
    }
    const normalizedExplicit = inferCampusFromText(explicit);
    if (normalizedExplicit) {
      return normalizedExplicit;
    }
    if (explicit.toLowerCase() !== 'semua kampus') {
      return explicit;
    }
  }

  return inferCampusFromText(lokasi ?? '') ?? 'Kampus Sanata Dharma';
}

