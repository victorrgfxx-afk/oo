/**
 * Citirea configurarii din environment. Totul e citit lazy (in interiorul
 * functiilor) ca sa nu pice build-ul cand lipsesc variabile - lipsa unei
 * variabile trebuie sa dea eroare clara la runtime, nu la `next build`.
 */

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) {
    throw new Error(
      `Lipseste variabila de mediu ${name}. Vezi SETUP.md pentru lista completa.`,
    );
  }
  return v;
}

export function envBool(name: string, fallback = false): boolean {
  const v = env(name);
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "da"].includes(v.toLowerCase());
}

export function envInt(name: string, fallback: number): number {
  const v = env(name);
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Numarul de ore dintre submit si livrarea pe mail. Default 48h. */
export function deliveryDelayHours(): number {
  return envInt("DELIVERY_DELAY_HOURS", 48);
}

/** Adresa publica a aplicatiei, folosita in linkuri din email. */
export function siteUrl(): string {
  const explicit = env("PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = env("VERCEL_PROJECT_PRODUCTION_URL") ?? env("VERCEL_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
