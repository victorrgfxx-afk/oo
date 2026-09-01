import crypto from "node:crypto";
import { env, requireEnv } from "./env";

/**
 * Client minimal peste Google Drive / Docs / Sheets, pe fetch.
 *
 * Autentificarea accepta doua moduri, si il alege pe primul configurat:
 *
 *  1. Service account  (GOOGLE_SERVICE_ACCOUNT_JSON)
 *     Recomandat daca aveti Google Workspace si un Shared Drive. Atentie:
 *     un service account NU are spatiu propriu in Drive, deci fisierele
 *     trebuie create intr-un Shared Drive (sau folositi modul 2).
 *
 *  2. OAuth user  (GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN)
 *     Recomandat pe Gmail personal: aplicatia scrie in Drive-ul vostru,
 *     ca si cum ati crea voi fisierele.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function fetchServiceAccountToken(): Promise<{
  value: string;
  expiresIn: number;
}> {
  const raw = requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  let creds: { client_email: string; private_key: string };
  try {
    // Acceptam si JSON brut, si JSON codificat base64 (mai usor de pus in Vercel).
    const text = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    creds = JSON.parse(text);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON nu e un JSON valid (nici brut, nici base64).",
    );
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON nu contine client_email si private_key.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signingInput = `${header}.${claim}`;

  let signature: Buffer;
  try {
    signature = crypto
      .createSign("RSA-SHA256")
      .update(signingInput)
      // In JSON-ul descarcat, newline-urile din cheie sunt escapate. Daca
      // variabila trece printr-un dashboard, uneori raman escapate literal.
      .sign(creds.private_key.replace(/\\n/g, "\n"));
  } catch (err) {
    throw new Error(
      "Cheia privata din GOOGLE_SERVICE_ACCOUNT_JSON nu poate fi citita. " +
        "Verifica sa fie exact continutul din fisierul descarcat din Google Cloud, " +
        "cu blocul -----BEGIN PRIVATE KEY----- intact. Daca dashboard-ul strica " +
        "newline-urile, codifica tot JSON-ul in base64 si pune rezultatul. " +
        `(detaliu: ${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Autentificare Google (service account) esuata: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { value: json.access_token, expiresIn: json.expires_in };
}

async function fetchOAuthToken(): Promise<{ value: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Autentificare Google (OAuth) esuata: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { value: json.access_token, expiresIn: json.expires_in };
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const token = env("GOOGLE_SERVICE_ACCOUNT_JSON")
    ? await fetchServiceAccountToken()
    : await fetchOAuthToken();
  cachedToken = {
    value: token.value,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
  return token.value;
}

async function googleFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google API ${res.status} pe ${url}: ${body.slice(0, 500)}`);
  }
  return res;
}

async function googleJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await googleFetch(url, init);
  return (await res.json()) as T;
}

/* --------------------------------- Drive --------------------------------- */

const DRIVE_QS = "supportsAllDrives=true&includeItemsFromAllDrives=true";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

/** Escapare pentru literalii din query-ul Drive (`q=`). */
function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findChild(
  parentId: string,
  name: string,
  mimeType?: string,
): Promise<DriveFile | null> {
  const clauses = [
    `'${q(parentId)}' in parents`,
    `name = '${q(name)}'`,
    "trashed = false",
  ];
  if (mimeType) clauses.push(`mimeType = '${q(mimeType)}'`);
  const url =
    `https://www.googleapis.com/drive/v3/files?${DRIVE_QS}` +
    `&q=${encodeURIComponent(clauses.join(" and "))}` +
    `&fields=${encodeURIComponent("files(id,name,mimeType,webViewLink)")}&pageSize=1`;
  const json = await googleJson<{ files: DriveFile[] }>(url);
  return json.files[0] ?? null;
}

export async function createFolder(
  parentId: string,
  name: string,
): Promise<DriveFile> {
  const existing = await findChild(parentId, name, FOLDER_MIME);
  if (existing) return existing;
  return googleJson<DriveFile>(
    `https://www.googleapis.com/drive/v3/files?${DRIVE_QS}&fields=${encodeURIComponent("id,name,mimeType,webViewLink")}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    },
  );
}

export async function listChildren(parentId: string): Promise<DriveFile[]> {
  const url =
    `https://www.googleapis.com/drive/v3/files?${DRIVE_QS}` +
    `&q=${encodeURIComponent(`'${q(parentId)}' in parents and trashed = false`)}` +
    `&fields=${encodeURIComponent("files(id,name,mimeType,webViewLink)")}&pageSize=200`;
  const json = await googleJson<{ files: DriveFile[] }>(url);
  return json.files ?? [];
}

/** Doar fisierele imagine dintr-un folder, sortate dupa nume. */
export async function listImages(parentId: string): Promise<DriveFile[]> {
  const files = await listChildren(parentId);
  return files
    .filter((f) => f.mimeType.startsWith("image/"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function uploadFile(
  parentId: string,
  name: string,
  mimeType: string,
  data: Uint8Array,
): Promise<DriveFile> {
  const boundary = `b${crypto.randomBytes(16).toString("hex")}`;
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const head = Buffer.from(
    `--${boundary}\r\n` +
      "content-type: application/json; charset=UTF-8\r\n\r\n" +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `content-type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([head, Buffer.from(data), tail]);

  return googleJson<DriveFile>(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${DRIVE_QS}&fields=${encodeURIComponent("id,name,mimeType,webViewLink")}`,
    {
      method: "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(body),
    },
  );
}

export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
  );
  return new Uint8Array(await res.arrayBuffer());
}

/** Metadatele unui fisier sau folder. Folosit de scriptul de verificare. */
export async function getFileMeta(fileId: string): Promise<DriveFile> {
  return googleJson<DriveFile>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
      `?supportsAllDrives=true&fields=${encodeURIComponent("id,name,mimeType,webViewLink")}`,
  );
}

/** Sterge definitiv un fisier sau folder. Folosit la curatarea testelor. */
export async function deleteFile(fileId: string): Promise<void> {
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: "DELETE" },
  );
}

/** Face fisierul vizibil pentru oricine are linkul (rol `reader`). */
export async function shareWithLink(fileId: string): Promise<void> {
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
}

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function docUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/** Muta un fisier intr-un alt folder, scotandu-l din parintii curenti. */
export async function moveFile(fileId: string, parentId: string): Promise<void> {
  const meta = await googleJson<{ parents?: string[] }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=parents`,
  );
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    addParents: parentId,
  });
  if (meta.parents?.length) params.set("removeParents", meta.parents.join(","));

  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" },
  );
}

/**
 * Creeaza o foaie de calcul cu prima fila deja denumita cum trebuie.
 * Se creeaza in radacina Drive-ului, apoi se muta in folderul cerut.
 */
export async function createSpreadsheet(
  title: string,
  sheetTitle: string,
  parentId?: string,
): Promise<string> {
  const created = await googleJson<{ spreadsheetId: string }>(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: sheetTitle } }],
      }),
    },
  );
  if (parentId) await moveFile(created.spreadsheetId, parentId);
  return created.spreadsheetId;
}

/* ---------------------------------- Docs ---------------------------------- */

export type DocBlock =
  | { t: "h1" | "h2" | "h3"; text: string }
  | { t: "p"; text: string; bold?: boolean }
  | { t: "bullet"; text: string };

/** Creeaza un Google Doc gol direct in folderul cerut. */
export async function createDoc(
  parentId: string,
  title: string,
): Promise<DriveFile> {
  return googleJson<DriveFile>(
    `https://www.googleapis.com/drive/v3/files?${DRIVE_QS}&fields=${encodeURIComponent("id,name,mimeType,webViewLink")}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: title, mimeType: DOC_MIME, parents: [parentId] }),
    },
  );
}

const NAMED_STYLE: Record<string, string> = {
  h1: "HEADING_1",
  h2: "HEADING_2",
  h3: "HEADING_3",
  p: "NORMAL_TEXT",
  bullet: "NORMAL_TEXT",
};

/**
 * Construieste request-urile de batchUpdate pentru un set de blocuri.
 *
 * Indicii din Docs API sunt in unitati UTF-16, exact ca `String.length` in JS,
 * asa ca putem calcula intervalele local. Textul se insereaza o singura data,
 * apoi aplicam stiluri - niciun request de stil nu modifica lungimea, deci
 * intervalele raman valide pe tot parcursul batch-ului.
 *
 * Functie pura, ca sa poata fi verificata fara sa atinga API-ul.
 */
export function buildDocRequests(blocks: DocBlock[]): unknown[] {
  if (blocks.length === 0) return [];

  let full = "";
  const spans: { block: DocBlock; start: number; end: number }[] = [];
  for (const block of blocks) {
    const start = 1 + full.length;
    // Docs nu accepta paragrafe complet goale, asa ca folosim un spatiu.
    const text = block.text.length > 0 ? block.text : " ";
    full += `${text}\n`;
    spans.push({ block, start, end: start + text.length });
  }

  const requests: unknown[] = [
    { insertText: { location: { index: 1 }, text: full } },
  ];

  for (const span of spans) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: span.start, endIndex: span.end },
        paragraphStyle: { namedStyleType: NAMED_STYLE[span.block.t] },
        fields: "namedStyleType",
      },
    });
    if (span.block.t === "p" && span.block.bold) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: span.start, endIndex: span.end },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
  }

  // Bulinele se aplica pe grupuri consecutive, ca sa iasa o singura lista.
  let groupStart: number | null = null;
  let groupEnd = 0;
  const flushBullets = () => {
    if (groupStart === null) return;
    requests.push({
      createParagraphBullets: {
        range: { startIndex: groupStart, endIndex: groupEnd },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    });
    groupStart = null;
  };
  for (const span of spans) {
    if (span.block.t === "bullet") {
      if (groupStart === null) groupStart = span.start;
      groupEnd = span.end;
    } else {
      flushBullets();
    }
  }
  flushBullets();

  return requests;
}

/** Scrie blocurile intr-un Doc gol. */
export async function writeDocBlocks(
  documentId: string,
  blocks: DocBlock[],
): Promise<void> {
  const requests = buildDocRequests(blocks);
  if (requests.length === 0) return;

  await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    },
  );
}

/** Textul brut al unui Google Doc - folosit pentru playbook-urile editabile. */
export async function readDocText(documentId: string): Promise<string> {
  const doc = await googleJson<{
    body?: {
      content?: {
        paragraph?: { elements?: { textRun?: { content?: string } }[] };
      }[];
    };
  }>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
  );
  const out: string[] = [];
  for (const item of doc.body?.content ?? []) {
    for (const el of item.paragraph?.elements ?? []) {
      if (el.textRun?.content) out.push(el.textRun.content);
    }
  }
  return out.join("");
}

/* --------------------------------- Sheets --------------------------------- */

function sheetsUrl(path: string, params?: Record<string, string>): string {
  const id = requireEnv("GOOGLE_SHEET_ID");
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${path}${qs}`;
}

export async function readSheet(range: string): Promise<string[][]> {
  const json = await googleJson<{ values?: string[][] }>(
    sheetsUrl(`/values/${encodeURIComponent(range)}`, {
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  );
  return json.values ?? [];
}

export async function writeSheet(
  range: string,
  values: (string | number)[][],
): Promise<void> {
  await googleFetch(
    sheetsUrl(`/values/${encodeURIComponent(range)}`, {
      valueInputOption: "RAW",
    }),
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
}

export async function appendSheet(
  range: string,
  values: (string | number)[][],
): Promise<void> {
  await googleFetch(
    sheetsUrl(`/values/${encodeURIComponent(range)}:append`, {
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    }),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
}
