import { env } from "./env";
import { appendSheet, readSheet, writeSheet } from "./google";
import type { Lead, NicheId, Platform, Status } from "./types";

/**
 * Persistenta pe Google Sheets. Foaia tine loc de baza de date pentru ca
 * echipa vede si editeaza direct starea fiecarui lead, fara alt serviciu.
 * Interfata e mica intentionat - daca la un moment dat trece pe Postgres,
 * doar fisierul asta se schimba.
 */

const HEADERS = [
  "id",
  "createdAt",
  "status",
  "niche",
  "platforms",
  "username",
  "email",
  "name",
  "website",
  "notes",
  "folderId",
  "folderUrl",
  "assetsFolderId",
  "screenshotCount",
  "batchId",
  "docId",
  "docUrl",
  "deliverAfter",
  "sentAt",
  "error",
] as const;

const LAST_COL = "T"; // 20 de coloane

function sheetName(): string {
  return env("GOOGLE_SHEET_NAME") ?? "Leads";
}

function range(a1: string): string {
  return `${sheetName()}!${a1}`;
}

function rowToLead(row: string[], rowNumber: number): Lead {
  const get = (i: number) => (row[i] ?? "").toString().trim();
  return {
    id: get(0),
    createdAt: get(1),
    status: (get(2) || "new") as Status,
    niche: get(3) as NicheId,
    platforms: get(4)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean) as Platform[],
    username: get(5),
    email: get(6),
    name: get(7),
    website: get(8),
    notes: get(9),
    folderId: get(10),
    folderUrl: get(11),
    assetsFolderId: get(12),
    screenshotCount: Number.parseInt(get(13) || "0", 10) || 0,
    batchId: get(14),
    docId: get(15),
    docUrl: get(16),
    deliverAfter: get(17),
    sentAt: get(18),
    error: get(19),
    rowNumber,
  };
}

function leadToRow(lead: Lead): string[] {
  return [
    lead.id,
    lead.createdAt,
    lead.status,
    lead.niche,
    lead.platforms.join(","),
    lead.username,
    lead.email,
    lead.name,
    lead.website,
    lead.notes,
    lead.folderId,
    lead.folderUrl,
    lead.assetsFolderId,
    String(lead.screenshotCount),
    lead.batchId,
    lead.docId,
    lead.docUrl,
    lead.deliverAfter,
    lead.sentAt,
    lead.error,
  ];
}

/** Scrie randul de antet daca foaia e goala. Idempotent. */
export async function ensureHeaders(): Promise<void> {
  const existing = await readSheet(range(`A1:${LAST_COL}1`));
  if (existing.length > 0 && (existing[0]?.[0] ?? "") === "id") return;
  await writeSheet(range(`A1:${LAST_COL}1`), [HEADERS as unknown as string[]]);
}

export async function listLeads(): Promise<Lead[]> {
  const rows = await readSheet(range(`A2:${LAST_COL}5000`));
  return rows
    .map((row, i) => rowToLead(row, i + 2))
    .filter((lead) => lead.id !== "");
}

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await listLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export async function insertLead(lead: Lead): Promise<void> {
  await ensureHeaders();
  await appendSheet(range(`A1:${LAST_COL}1`), [leadToRow(lead)]);
}

/** Rescrie randul unui lead. Necesita `rowNumber` (vine din listLeads/getLead). */
export async function updateLead(lead: Lead): Promise<void> {
  if (!lead.rowNumber) {
    throw new Error(`Lead ${lead.id} nu are rowNumber; nu il pot actualiza.`);
  }
  await writeSheet(
    range(`A${lead.rowNumber}:${LAST_COL}${lead.rowNumber}`),
    [leadToRow(lead)],
  );
}

/** Actualizare partiala, ca sa nu trebuiasca reconstruit tot obiectul. */
export async function patchLead(
  lead: Lead,
  patch: Partial<Lead>,
): Promise<Lead> {
  const next = { ...lead, ...patch };
  await updateLead(next);
  return next;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
