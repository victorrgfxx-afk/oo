/** Curatarea datelor venite din formular. */

/**
 * Accepta ce apuca omul sa scrie in campul de username: "@nume", "nume",
 * "instagram.com/nume/", "https://www.tiktok.com/@nume?lang=ro".
 * Intoarce doar handle-ul, fara "@" si fara slash-uri.
 */
export function normalizeUsername(raw: string): string {
  let value = raw.trim();
  const urlMatch = value.match(/(?:instagram|tiktok|facebook)\.com\/+@?([^/?#\s]+)/i);
  if (urlMatch?.[1]) value = urlMatch[1];
  return value.replace(/^@+/, "").replace(/\/+$/, "").trim();
}

/** Nume de folder Drive: lizibil pentru echipa, fara caractere care dau batai de cap. */
export function folderName(username: string, nicheLabel: string, date = new Date()): string {
  const safe = username.replace(/[\\/:*?"<>|]/g, "-");
  return `@${safe} - ${nicheLabel} - ${date.toISOString().slice(0, 10)}`;
}
