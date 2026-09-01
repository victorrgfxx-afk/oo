/**
 * Verifica setarea completa, cu apeluri reale, inainte de a porni sistemul.
 *
 *   npm run check              verifica tot, fara sa lase urme
 *   npm run check -- --email   trimite si un email de test catre TEAM_EMAIL
 *
 * Ce face concret: cere un token Google, citeste folderul-parinte, scrie si
 * sterge un folder si un document de proba, pune antetul in foaia de calcul,
 * si atinge Anthropic cu o cerere minima. Daca trece tot, fluxul real merge.
 */
import { loadEnvFiles } from "./lib/env-file";
import { c } from "./lib/cli";

import Anthropic from "@anthropic-ai/sdk";
import {
  createDoc,
  createFolder,
  deleteFile,
  getAccessToken,
  getFileMeta,
  writeDocBlocks,
} from "../src/lib/google";
import { ensureHeaders, listLeads } from "../src/lib/store";
import { sendEmail } from "../src/lib/mail";
import { NICHES } from "../src/lib/niches";
import { loadPlaybook } from "../src/lib/audit";
import { env } from "../src/lib/env";

let failures = 0;
let warnings = 0;

function ok(label: string, detail = "") {
  console.log(`  ${c.green("✓")} ${label}${detail ? c.dim(`  ${detail}`) : ""}`);
}

function fail(label: string, err: unknown) {
  failures++;
  const message = err instanceof Error ? err.message : String(err);
  console.log(`  ${c.red("✗")} ${label}`);
  console.log(`    ${c.red(message.slice(0, 300))}`);
}

function warn(label: string, detail = "") {
  warnings++;
  console.log(`  ${c.yellow("!")} ${label}${detail ? c.dim(`  ${detail}`) : ""}`);
}

async function step(label: string, fn: () => Promise<string | void>) {
  try {
    ok(label, (await fn()) || "");
  } catch (err) {
    fail(label, err);
  }
}

async function main() {
  const loaded = loadEnvFiles();
  console.log(
    `\n${c.bold("Verificare configurare")}${loaded.length ? c.dim(`  (am citit ${loaded.join(", ")})`) : ""}\n`,
  );

  /* ------------------------------ Variabile ------------------------------ */
  console.log(c.bold("Variabile de mediu"));

  const required = [
    "ANTHROPIC_API_KEY",
    "GOOGLE_DRIVE_PARENT_FOLDER_ID",
    "GOOGLE_SHEET_ID",
    "ADMIN_PASSWORD",
    "CRON_SECRET",
  ];
  for (const name of required) {
    if (env(name)) ok(name);
    else {
      failures++;
      console.log(`  ${c.red("✗")} ${name} ${c.dim("lipseste")}`);
    }
  }

  const hasServiceAccount = Boolean(env("GOOGLE_SERVICE_ACCOUNT_JSON"));
  const hasOAuth = Boolean(env("GOOGLE_OAUTH_REFRESH_TOKEN"));
  if (hasServiceAccount) ok("Autentificare Google", "service account");
  else if (hasOAuth) ok("Autentificare Google", "OAuth pe cont personal");
  else {
    failures++;
    console.log(
      `  ${c.red("✗")} Autentificare Google ${c.dim("nici GOOGLE_SERVICE_ACCOUNT_JSON, nici GOOGLE_OAUTH_REFRESH_TOKEN")}`,
    );
  }

  if (!env("BREVO_API_KEY")) warn("BREVO_API_KEY lipseste", "emailurile vor fi doar logate");
  if (!env("TEAM_EMAIL")) warn("TEAM_EMAIL lipseste", "nu primiti notificari interne");
  if (!env("MAIL_FROM_EMAIL")) warn("MAIL_FROM_EMAIL lipseste", "necesar pentru trimitere");

  if (failures > 0) {
    console.log(`\n${c.red("Opresc aici")} - completeaza variabilele de mai sus si reia.\n`);
    process.exit(1);
  }

  /* -------------------------------- Google ------------------------------- */
  console.log(`\n${c.bold("Google")}`);

  let parentOk = false;
  await step("Obtinere token de acces", async () => {
    const token = await getAccessToken();
    return `token de ${token.length} caractere`;
  });

  await step("Acces la folderul-parinte din Drive", async () => {
    const meta = await getFileMeta(env("GOOGLE_DRIVE_PARENT_FOLDER_ID")!);
    parentOk = true;
    return `"${meta.name}"`;
  });

  let testFolderId: string | null = null;
  if (parentOk) {
    await step("Creare folder de proba", async () => {
      const folder = await createFolder(
        env("GOOGLE_DRIVE_PARENT_FOLDER_ID")!,
        `__test-configurare-${Date.now()}`,
      );
      testFolderId = folder.id;
      return folder.name;
    });
  }

  if (testFolderId) {
    await step("Creare si scriere document de proba", async () => {
      const doc = await createDoc(testFolderId!, "Document de proba");
      await writeDocBlocks(doc.id, [
        { t: "h1", text: "Verificare configurare" },
        { t: "p", text: "Daca vezi acest text, scrierea in Google Docs functioneaza." },
        { t: "bullet", text: "Drive: da" },
        { t: "bullet", text: "Docs: da" },
      ]);
      return doc.id;
    });

    await step("Stergere folder de proba", async () => {
      await deleteFile(testFolderId!);
      testFolderId = null;
    });
  }

  await step("Acces la foaia de calcul", async () => {
    await ensureHeaders();
    const leads = await listLeads();
    return `${leads.length} randuri`;
  });

  /* ------------------------------- Playbooks ----------------------------- */
  console.log(`\n${c.bold("Playbook-uri de nisa")}`);
  for (const niche of NICHES) {
    await step(niche.label, async () => {
      const text = await loadPlaybook(niche.id);
      const fromDoc = env(niche.kbDocEnv)
        ? text.includes("Completari de la echipa")
          ? ", plus completarile din Doc"
          : `, dar ${niche.kbDocEnv} nu a putut fi citit`
        : "";
      return `${text.length} caractere${fromDoc}`;
    });
  }

  /* ------------------------------- Anthropic ----------------------------- */
  console.log(`\n${c.bold("Anthropic")}`);
  await step("Cheia API functioneaza", async () => {
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY")! });
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16,
      messages: [{ role: "user", content: "Raspunde doar cu cuvantul: gata" }],
    });
    const text = message.content.find((b) => b.type === "text");
    return text && text.type === "text" ? `raspuns: "${text.text.trim()}"` : "raspuns primit";
  });

  await step("Batch API accesibil", async () => {
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY")! });
    const list = await client.messages.batches.list({ limit: 1 });
    return `${list.data.length} batch-uri recente`;
  });

  /* --------------------------------- Email ------------------------------- */
  if (process.argv.includes("--email")) {
    console.log(`\n${c.bold("Email")}`);
    const to = env("TEAM_EMAIL");
    if (!to) warn("Sar peste", "TEAM_EMAIL nu e setat");
    else {
      await step(`Trimitere email de test catre ${to}`, async () => {
        await sendEmail({
          to,
          subject: "Test configurare audit social media",
          html: "<p>Daca ai primit acest email, Brevo e configurat corect.</p>",
        });
        return "verifica inboxul";
      });
    }
  } else {
    console.log(`\n${c.dim("Email: sarit. Adauga --email ca sa trimiti un mesaj de test.")}`);
  }

  /* -------------------------------- Concluzie ---------------------------- */
  console.log("");
  if (failures === 0) {
    console.log(
      c.green(c.bold("Totul functioneaza.")) +
        (warnings > 0 ? c.dim(` (${warnings} avertismente mai sus)`) : "") +
        "\n",
    );
  } else {
    console.log(c.red(c.bold(`${failures} verificari au picat.`)) + " Vezi mesajele de mai sus.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${c.red("A picat:")} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
