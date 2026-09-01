/**
 * Agent de test pentru auditul de social media.
 *
 * Ruleaza exact acelasi prompt, aceeasi schema si aceeasi randare ca productia,
 * dar pe capturi de pe disc si fara sa atinga Drive, Sheets sau Brevo. Serveste
 * la doua lucruri: sa vezi calitatea auditului inainte de a porni sistemul, si
 * sa reglezi playbook-urile de nisa iterand rapid.
 *
 *   npm run audit -- --nisa beauty --username ana_beauty --dir ./capturi
 *   npm run audit -- --nisa horeca --username local --dir ./capturi --fara-api
 *
 * Optiuni:
 *   --nisa        beauty | horeca | fitness | imobiliare   (obligatoriu)
 *   --username    contul analizat, doar pentru context     (obligatoriu)
 *   --dir         folder cu capturi de ecran
 *   --platforme   instagram,tiktok,facebook   (implicit: instagram)
 *   --note        ce a scris clientul despre situatia lui
 *   --out         unde se scriu rezultatele   (implicit: ./rezultate)
 *   --fara-api    foloseste un audit de proba, nu cheama Claude (gratis)
 *
 * Se pot da si cai de fisiere direct, ca argumente pozitionale.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvFiles } from "./lib/env-file";
import { c, parseArgs } from "./lib/cli";
import { blocksToMarkdown } from "./lib/preview";
import { FIXTURE } from "./lib/fixture";

import {
  anthropic,
  buildAuditRequest,
  isSupportedImage,
  parseAuditResult,
  MODEL,
} from "../src/lib/audit";
import { renderAudit } from "../src/lib/render";
import { NICHES, getNiche, nicheLabel } from "../src/lib/niches";
import { normalizeUsername } from "../src/lib/format";
import type { AuditResult, Lead, Platform } from "../src/lib/types";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Pretul Opus 5, in dolari per milion de tokeni. */
const PRICE_IN = 5;
const PRICE_OUT = 25;

function die(message: string): never {
  console.error(`\n${c.red("Eroare:")} ${message}\n`);
  process.exit(1);
}

function collectImages(dir: string | undefined, extra: string[]): string[] {
  const files: string[] = [];

  if (dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      die(`Folderul ${dir} nu exista.`);
    }
    for (const name of fs.readdirSync(dir).sort()) {
      if (MIME_BY_EXT[path.extname(name).toLowerCase()]) files.push(path.join(dir, name));
    }
  }

  for (const file of extra) {
    if (!fs.existsSync(file)) die(`Fisierul ${file} nu exista.`);
    files.push(file);
  }

  return files;
}

function bar(score: number): string {
  const filled = Math.round((score / 100) * 20);
  const color = score >= 70 ? c.green : score >= 45 ? c.yellow : c.red;
  return `${color("█".repeat(filled))}${c.dim("░".repeat(20 - filled))}`;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const nicheId = args.values.get("nisa");
  const rawUsername = args.values.get("username");
  const withoutApi = args.flags.has("fara-api");

  if (!nicheId || !rawUsername) {
    console.error(
      `\nFolosire:\n  npm run audit -- --nisa <${NICHES.map((n) => n.id).join("|")}> --username <cont> --dir <folder>\n\n` +
        `Adauga --fara-api ca sa testezi randarea fara sa cheltui nimic.\n`,
    );
    process.exit(1);
  }
  if (!getNiche(nicheId)) {
    die(`Nisa "${nicheId}" nu exista. Alege dintre: ${NICHES.map((n) => n.id).join(", ")}`);
  }

  const username = normalizeUsername(rawUsername);
  const platforms = (args.values.get("platforme") ?? "instagram")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Platform[];

  const imagePaths = collectImages(args.values.get("dir"), args.positional);
  if (imagePaths.length === 0 && !withoutApi) {
    die(
      "Nu am gasit nicio captura. Da --dir cu folderul lor, sau ruleaza cu --fara-api ca sa testezi doar randarea.",
    );
  }

  const lead: Lead = {
    id: "test",
    createdAt: new Date().toISOString(),
    status: "processing",
    niche: nicheId as Lead["niche"],
    platforms,
    username,
    email: "test@exemplu.ro",
    name: args.values.get("nume") ?? "",
    website: args.values.get("site") ?? "",
    notes: args.values.get("note") ?? "",
    folderId: "",
    folderUrl: "",
    assetsFolderId: "",
    screenshotCount: imagePaths.length,
    batchId: "",
    docId: "",
    docUrl: "",
    deliverAfter: "",
    sentAt: "",
    error: "",
  };

  console.log(`\n${c.bold(`Audit de test: @${username}`)}`);
  console.log(c.dim(`Nisa: ${nicheLabel(nicheId)}  |  Platforme: ${platforms.join(", ")}`));

  let audit: AuditResult;
  let usage: { input: number; output: number } | null = null;

  if (withoutApi) {
    console.log(c.dim("Mod fara API: folosesc auditul de proba, nu chem Claude.\n"));
    audit = FIXTURE;
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      die("ANTHROPIC_API_KEY nu e setat. Pune-l in .env.local sau ruleaza cu --fara-api.");
    }

    const screenshots = imagePaths.map((file) => {
      const mimeType = MIME_BY_EXT[path.extname(file).toLowerCase()];
      if (!mimeType || !isSupportedImage(mimeType)) {
        die(`Formatul lui ${file} nu e acceptat. Trimite JPG, PNG sau WEBP.`);
      }
      return { name: path.basename(file), mimeType, data: new Uint8Array(fs.readFileSync(file)) };
    });

    const totalMb = screenshots.reduce((sum, s) => sum + s.data.length, 0) / 1024 / 1024;
    console.log(c.dim(`${screenshots.length} capturi, ${totalMb.toFixed(1)} MB\n`));

    const request = await buildAuditRequest(lead, screenshots);

    // Productia ruleaza prin Batch API (jumatate de pret, pana la 24h).
    // Aici mergem sincron, ca sa vezi rezultatul imediat.
    process.stdout.write(c.dim("Rulez analiza... "));
    const started = Date.now();
    const stream = anthropic().messages.stream(request.params);
    const message = await stream.finalMessage();
    console.log(c.dim(`gata in ${((Date.now() - started) / 1000).toFixed(0)}s\n`));

    if (message.stop_reason === "refusal") {
      die("Modelul a refuzat cererea. Verifica ce contin capturile.");
    }

    usage = { input: message.usage.input_tokens, output: message.usage.output_tokens };
    audit = parseAuditResult(message);
  }

  /* ------------------------------ Rezultate ------------------------------ */

  const blocks = renderAudit(lead, audit);
  const markdown = blocksToMarkdown(blocks);

  const outDir = args.values.get("out") ?? "rezultate";
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `${username}-${Date.now()}`);
  fs.writeFileSync(`${base}.md`, markdown);
  fs.writeFileSync(`${base}.json`, JSON.stringify(audit, null, 2));

  console.log(c.bold(`Scor general: ${audit.scor_general}/100\n`));
  const rows: [string, number][] = [
    ["Bio si pozitionare", audit.scoruri.bio_si_pozitionare],
    ["Identitate vizuala", audit.scoruri.identitate_vizuala],
    ["Calitate continut", audit.scoruri.calitate_continut],
    ["Engagement", audit.scoruri.engagement_si_comunitate],
    ["Conversie", audit.scoruri.conversie],
  ];
  for (const [label, score] of rows) {
    console.log(`  ${label.padEnd(20)} ${bar(score)} ${String(score).padStart(3)}`);
  }

  const mari = audit.probleme.filter((p) => p.prioritate === "mare");
  console.log(`\n${c.bold("Probleme de prioritate mare:")}`);
  for (const problem of mari) console.log(`  - ${problem.titlu}`);

  console.log(`\n${c.bold("Primele trei idei de continut:")}`);
  for (const idea of audit.idei_continut.slice(0, 3)) {
    console.log(`  - ${idea.titlu} ${c.dim(`(${idea.format})`)}`);
    console.log(`    ${c.dim(`"${idea.hook}"`)}`);
  }

  console.log(`\n${c.bold("Verificari:")}`);
  const checks: [boolean, string][] = [
    [audit.idei_continut.length === 12, `12 idei de continut (am ${audit.idei_continut.length})`],
    [audit.copy.bio.length === 3, `3 variante de bio (am ${audit.copy.bio.length})`],
    [audit.copy.nume_afisat.length === 3, `3 variante de nume (am ${audit.copy.nume_afisat.length})`],
    [audit.plan_30_zile.length === 4, `plan pe 4 saptamani (am ${audit.plan_30_zile.length})`],
    [mari.length > 0, `cel putin o problema de prioritate mare (am ${mari.length})`],
    [audit.copy.bio.every((b) => b.varianta.length <= 150), "toate bio-urile incap in 150 de caractere"],
    [audit.idei_continut.every((i) => i.hook.trim().length > 0), "fiecare idee are hook scris"],
  ];
  for (const [ok, label] of checks) {
    console.log(`  ${ok ? c.green("✓") : c.red("✗")} ${label}`);
  }

  if (usage) {
    const sync = (usage.input / 1e6) * PRICE_IN + (usage.output / 1e6) * PRICE_OUT;
    console.log(`\n${c.bold("Consum:")}`);
    console.log(c.dim(`  ${usage.input.toLocaleString("ro-RO")} tokeni intrare, ${usage.output.toLocaleString("ro-RO")} iesire`));
    console.log(c.dim(`  Costul acestei rulari (sincron): $${sync.toFixed(3)}`));
    console.log(c.dim(`  In productie, prin Batch API: $${(sync / 2).toFixed(3)} per audit`));
  }

  console.log(`\n${c.bold("Fisiere scrise:")}`);
  console.log(`  ${base}.md    ${c.dim("(documentul, exact cum ajunge in Google Docs)")}`);
  console.log(`  ${base}.json  ${c.dim("(raspunsul brut)")}`);
  console.log(c.dim(`\nModel: ${MODEL}\n`));
}

main().catch((err) => {
  console.error(`\n${c.red("A picat:")} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
