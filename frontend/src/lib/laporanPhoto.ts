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
