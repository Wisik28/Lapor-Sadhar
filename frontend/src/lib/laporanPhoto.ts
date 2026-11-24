export function getFotoList(foto?: string | string[] | null): string[] {
  if (!foto) return [];

  if (Array.isArray(foto)) {
    return foto.filter((item) => typeof item === "string" && item.trim());
  }

  try {
    const parsed: unknown = JSON.parse(foto);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
    }
  } catch {
    // A single photo path or data URL is stored as plain text.
  }

  return foto.trim() ? [foto] : [];
}

export function getFotoUrl(foto: string): string {
  if (/^(https?:|data:image\/|blob:)/i.test(foto)) return foto;

  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api")
    .replace(/\/api\/?$/, "");

  return `${base}/${foto.replace(/^\/+/, "")}`;
}

/**
 * Hasilkan URL thumbnail teroptimasi untuk tampilan daftar/kartu.
 * Untuk URL Cloudinary, menyisipkan transformasi `f_auto,q_auto,w_<width>,c_limit`
 * agar gambar resolusi penuh hanya diunduh saat pengguna membuka pratinjau penuh.
 */
export function getThumbnailFotoUrl(foto: string, width: number = 600): string {
  const url = getFotoUrl(foto);
  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!match) {
    return url;
  }

  const [, prefix, rest] = match;
  // Jangan gandakan transformasi jika segmen pertama sudah berisi parameter Cloudinary (mis. f_auto, w_400)
  if (/^(?:[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*)\//i.test(rest)) {
    return url;
  }

  const safeWidth = Math.max(120, Math.min(1600, Math.round(width)));
  return `${prefix}f_auto,q_auto,w_${safeWidth},c_limit/${rest}`;
}
