import fs from "node:fs";
import path from "node:path";

/**
 * Incarca .env.local / .env pentru scripturile rulate din terminal.
 * Next.js le citeste singur, dar un script pornit cu tsx nu.
 * Variabilele deja setate in shell au prioritate.
 */
export function loadEnvFiles(root = process.cwd()): string[] {
  const loaded: string[] = [];

  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;

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
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }

  return loaded;
}
