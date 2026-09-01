import fs from "node:fs";
import path from "node:path";

/**
 * Citirea si scrierea .env.local, pastrand comentariile si ordinea existenta.
 * Scripturile de setup adauga sau actualizeaza chei fara sa strice ce e deja
 * acolo si fara sa rescrie fisierul de la zero.
 */

const FILE = ".env.local";

export function envPath(root = process.cwd()): string {
  return path.join(root, FILE);
}

export function readEnvFile(root = process.cwd()): Map<string, string> {
  const full = envPath(root);
  const map = new Map<string, string>();
  if (!fs.existsSync(full)) return map;

  for (const rawLine of fs.readFileSync(full, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) map.set(key, value);
  }
  return map;
}

/** Valorile care contin spatii sau ghilimele se scriu intre ghilimele duble. */
function serialize(value: string): string {
  return /[\s"'#]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * Actualizeaza cheile date. Cele existente sunt inlocuite pe loc, cele noi
 * se adauga la final. Restul fisierului ramane neatins.
 */
export function updateEnvFile(
  updates: Record<string, string>,
  root = process.cwd(),
): void {
  const full = envPath(root);
  const lines = fs.existsSync(full) ? fs.readFileSync(full, "utf8").split("\n") : [];
  const remaining = new Map(Object.entries(updates));

  const next = lines.map((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return rawLine;
    const eq = line.indexOf("=");
    if (eq === -1) return rawLine;
    const key = line.slice(0, eq).trim();
    if (!remaining.has(key)) return rawLine;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${serialize(value)}`;
  });

  if (remaining.size > 0) {
    if (next.length > 0 && next[next.length - 1].trim() !== "") next.push("");
    next.push(`# Adaugate automat de scripturile de setup, ${new Date().toISOString().slice(0, 10)}`);
    for (const [key, value] of remaining) next.push(`${key}=${serialize(value)}`);
    next.push("");
  }

  fs.writeFileSync(full, next.join("\n"));
}
