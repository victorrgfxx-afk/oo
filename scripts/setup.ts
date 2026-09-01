/**
 * Pregateste tot ce se poate pregati automat, o singura data.
 *
 *   npm run setup
 *
 * Concret: genereaza parolele care lipsesc, creeaza in Drive folderul de
 * clienti, foaia de calcul cu antetul pus, si cate un Google Doc de playbook
 * pentru fiecare nisa, apoi scrie toate ID-urile in .env.local.
 *
 * Ruleaza de cate ori vrei: gaseste ce exista deja si nu duplica nimic.
 */
import crypto from "node:crypto";
import { loadEnvFiles } from "./lib/env-file";
import { readEnvFile, updateEnvFile } from "./lib/env-write";
import { c } from "./lib/cli";

import {
  createDoc,
  createFolder,
  createSpreadsheet,
  docUrl,
  findChild,
  folderUrl,
  getAccessToken,
  writeDocBlocks,
  type DocBlock,
} from "../src/lib/google";
import { ensureHeaders } from "../src/lib/store";
import { NICHES } from "../src/lib/niches";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const NUME_FOLDER_CLIENTI = "Audituri - clienti";
const NUME_FOLDER_PLAYBOOK = "Audituri - playbook-uri";
const NUME_FOAIE = "Audituri - leaduri";
const NUME_FILA = "Leads";

const modificari: Record<string, string> = {};
const rezumat: string[] = [];

function pas(mesaj: string) {
  console.log(`  ${c.green("✓")} ${mesaj}`);
}

/** Parola lizibila, usor de citit la telefon si de dictat. */
function paroleLizibila(): string {
  const cuvinte = [
    "cafea", "munte", "portal", "vulpe", "seara", "ancora", "piatra", "zambet",
    "fereastra", "carte", "furtuna", "lumina", "cerneala", "padure", "ceas",
  ];
  const alege = () => cuvinte[crypto.randomInt(cuvinte.length)];
  return `${alege()}-${alege()}-${crypto.randomInt(100, 1000)}`;
}

/** Transforma textul playbook-ului in blocuri de Google Docs. */
function textToBlocks(text: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("### ")) blocks.push({ t: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ t: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ t: "h1", text: line.slice(2) });
    else if (line.startsWith("- ")) blocks.push({ t: "bullet", text: line.slice(2) });
    else blocks.push({ t: "p", text: line });
  }
  return blocks;
}

/** Continutul initial al unui doc de playbook: instructiuni, nu o copie a codului. */
function playbookInitial(label: string, fisier: string): string {
  return `# Completari pentru ${label}

Tot ce scrii aici se adauga la playbook-ul agentului la fiecare rulare, fara deploy. Foloseste-l pentru lucruri pe care le inveti din audituri reale.

Playbook-ul de baza sta in cod, la src/lib/knowledge/${fisier}.ts. Doc-ul asta il completeaza, nu il inlocuieste.

## Hook-uri care au functionat
Scrie aici replici concrete care au mers, cu context.

## Greseli pe care le vedem des
Ce apare mereu in conturile din nisa asta.

## Formate care performeaza acum
Ce merge in perioada asta, si ce a incetat sa mearga.

## Exemple din piata
Conturi bune, campanii reusite, referinte utile.`;
}

async function main() {
  loadEnvFiles();
  const env = readEnvFile();
  const val = (k: string) => process.env[k] || env.get(k) || "";

  console.log(`\n${c.bold("Pregatire automata")}\n`);

  /* ------------------------------- Secrete ------------------------------- */
  console.log(c.bold("Parole si secrete"));

  if (val("ADMIN_PASSWORD")) pas("ADMIN_PASSWORD exista deja");
  else {
    const parola = paroleLizibila();
    modificari.ADMIN_PASSWORD = parola;
    pas(`ADMIN_PASSWORD generat: ${c.bold(parola)}`);
    rezumat.push(`Parola panoului /admin: ${parola}`);
  }

  if (val("CRON_SECRET")) pas("CRON_SECRET exista deja");
  else {
    modificari.CRON_SECRET = crypto.randomBytes(32).toString("hex");
    pas("CRON_SECRET generat");
  }

  if (!val("GOOGLE_SHEET_NAME")) modificari.GOOGLE_SHEET_NAME = NUME_FILA;

  /* -------------------------------- Google ------------------------------- */
  const areGoogle =
    Boolean(val("GOOGLE_SERVICE_ACCOUNT_JSON")) || Boolean(val("GOOGLE_OAUTH_REFRESH_TOKEN"));

  if (!areGoogle) {
    updateEnvFile(modificari);
    console.log(`\n${c.yellow("Google nu e configurat inca.")}`);
    console.log(`Ruleaza intai:  ${c.bold("npm run google-login")}`);
    console.log(c.dim("Apoi reia npm run setup si va crea tot restul.\n"));
    return;
  }

  console.log(`\n${c.bold("Google Drive")}`);
  await getAccessToken();
  pas("autentificare reusita");

  // Un service account nu are Drive propriu, deci nu poate crea nimic in "root".
  // In modul asta folderul trebuie sa existe deja, intr-un Shared Drive.
  const eServiceAccount = Boolean(val("GOOGLE_SERVICE_ACCOUNT_JSON"));
  if (eServiceAccount && !val("GOOGLE_DRIVE_PARENT_FOLDER_ID")) {
    updateEnvFile(modificari);
    console.log(`\n${c.yellow("Cu service account nu pot crea folderul singur.")}`);
    console.log("Un service account nu are spatiu propriu in Drive. Creeaza manual");
    console.log("un folder intr-un Shared Drive, da-i acces service account-ului ca");
    console.log("Content manager, si pune-i ID-ul in GOOGLE_DRIVE_PARENT_FOLDER_ID.");
    console.log(c.dim("\nAlternativ, pe cont personal: npm run google-login\n"));
    return;
  }

  // Folderul de clienti. Daca e deja setat in env, il folosim ca atare.
  let folderClienti = val("GOOGLE_DRIVE_PARENT_FOLDER_ID");
  if (folderClienti) {
    pas("folderul de clienti era deja configurat");
  } else {
    const existent = await findChild("root", NUME_FOLDER_CLIENTI, FOLDER_MIME);
    const folder = existent ?? (await createFolder("root", NUME_FOLDER_CLIENTI));
    folderClienti = folder.id;
    modificari.GOOGLE_DRIVE_PARENT_FOLDER_ID = folder.id;
    pas(`${existent ? "am gasit" : "am creat"} folderul "${NUME_FOLDER_CLIENTI}"`);
    rezumat.push(`Folderul clientilor: ${folderUrl(folder.id)}`);
  }

  /* ---------------------------- Foaia de calcul --------------------------- */
  console.log(`\n${c.bold("Foaia de calcul")}`);

  let sheetId = val("GOOGLE_SHEET_ID");
  if (sheetId) {
    pas("foaia era deja configurata");
  } else {
    const existenta = await findChild(folderClienti, NUME_FOAIE, SHEET_MIME);
    sheetId = existenta?.id ?? (await createSpreadsheet(NUME_FOAIE, NUME_FILA, folderClienti));
    modificari.GOOGLE_SHEET_ID = sheetId;
    pas(`${existenta ? "am gasit" : "am creat"} foaia "${NUME_FOAIE}"`);
    rezumat.push(`Foaia de leaduri: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
  }

  // ensureHeaders citeste din env, deci punem valorile inainte de apel.
  process.env.GOOGLE_SHEET_ID = sheetId;
  process.env.GOOGLE_SHEET_NAME = val("GOOGLE_SHEET_NAME") || NUME_FILA;
  await ensureHeaders();
  pas("antetul e pus");

  /* ------------------------------ Playbook-uri ---------------------------- */
  console.log(`\n${c.bold("Playbook-uri editabile")}`);

  const folderPlaybook =
    (await findChild("root", NUME_FOLDER_PLAYBOOK, FOLDER_MIME)) ??
    (await createFolder("root", NUME_FOLDER_PLAYBOOK));

  for (const niche of NICHES) {
    if (val(niche.kbDocEnv)) {
      pas(`${niche.label}: exista deja`);
      continue;
    }
    const titlu = `Playbook - ${niche.label}`;
    const existent = await findChild(folderPlaybook.id, titlu);
    if (existent) {
      modificari[niche.kbDocEnv] = existent.id;
      pas(`${niche.label}: am gasit documentul`);
      continue;
    }
    const doc = await createDoc(folderPlaybook.id, titlu);
    await writeDocBlocks(doc.id, textToBlocks(playbookInitial(niche.label, niche.id)));
    modificari[niche.kbDocEnv] = doc.id;
    pas(`${niche.label}: document creat`);
    rezumat.push(`Playbook ${niche.label}: ${docUrl(doc.id)}`);
  }

  updateEnvFile(modificari);

  /* -------------------------------- Rezumat ------------------------------- */
  console.log(`\n${c.green(c.bold("Gata."))} Am scris tot in .env.local\n`);
  if (rezumat.length > 0) {
    console.log(c.bold("Ce s-a creat:"));
    for (const linie of rezumat) console.log(`  ${linie}`);
    console.log("");
  }

  const lipsesc: string[] = [];
  if (!val("ANTHROPIC_API_KEY")) lipsesc.push("ANTHROPIC_API_KEY - console.anthropic.com");
  if (!val("BREVO_API_KEY")) lipsesc.push("BREVO_API_KEY - Brevo, SMTP & API");
  if (!val("MAIL_FROM_EMAIL")) lipsesc.push("MAIL_FROM_EMAIL - pe domeniul tau, nu pe gmail.com");
  if (!val("TEAM_EMAIL")) lipsesc.push("TEAM_EMAIL - unde primiti notificarile interne");

  if (lipsesc.length > 0) {
    console.log(c.bold("Ce mai trebuie pus de mana in .env.local:"));
    for (const item of lipsesc) console.log(`  ${c.yellow("·")} ${item}`);
    console.log("");
  }

  console.log(`Verifica tot cu:  ${c.bold("npm run check")}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red("A picat:")} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
