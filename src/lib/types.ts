export type NicheId = "beauty" | "horeca" | "fitness" | "imobiliare";

export type Platform = "instagram" | "tiktok" | "facebook";

/**
 * Ciclul de viata al unei cereri de audit.
 *
 *  new            -> tocmai a intrat prin formular (stare tranzitorie)
 *  awaiting_assets-> nu avem inca capturi de ecran; asteptam sa le puna echipa in Drive
 *  queued         -> avem capturi, asteptam sa intre in urmatorul batch Claude
 *  processing     -> request-ul e trimis in Batch API, asteptam rezultatul
 *  draft_ready    -> documentul e generat in Drive; asteapta interventia umana
 *  approved       -> aprobat de echipa; se trimite cand se implineste fereastra de livrare
 *  sent           -> livrat pe mail clientului
 *  failed         -> ceva a esuat; vezi coloana `error`
 */
export type Status =
  | "new"
  | "awaiting_assets"
  | "queued"
  | "processing"
  | "draft_ready"
  | "approved"
  | "sent"
  | "failed";

export const ALL_STATUSES: Status[] = [
  "new",
  "awaiting_assets",
  "queued",
  "processing",
  "draft_ready",
  "approved",
  "sent",
  "failed",
];

/** Un rand din foaia de calcul care tine loc de baza de date. */
export interface Lead {
  id: string;
  createdAt: string;
  status: Status;
  niche: NicheId;
  platforms: Platform[];
  username: string;
  email: string;
  name: string;
  website: string;
  notes: string;
  folderId: string;
  folderUrl: string;
  assetsFolderId: string;
  screenshotCount: number;
  batchId: string;
  docId: string;
  docUrl: string;
  deliverAfter: string;
  sentAt: string;
  error: string;
  /** Indexul randului in foaie (1-based, incluzand headerul). Nu se salveaza. */
  rowNumber?: number;
}

/** Structura pe care o cerem de la Claude, in JSON, pentru fiecare audit. */
export interface AuditResult {
  scor_general: number;
  scoruri: {
    bio_si_pozitionare: number;
    identitate_vizuala: number;
    calitate_continut: number;
    engagement_si_comunitate: number;
    conversie: number;
  };
  prima_impresie: string;
  puncte_forte: string[];
  probleme: {
    titlu: string;
    de_ce_conteaza: string;
    cum_repari: string;
    prioritate: "mare" | "medie" | "mica";
  }[];
  copy: {
    nume_afisat: { varianta: string; motiv: string }[];
    bio: { varianta: string; motiv: string }[];
    call_to_action: string[];
    highlights: string[];
  };
  idei_continut: {
    titlu: string;
    format: string;
    hook: string;
    structura: string[];
    cta: string;
    de_ce_functioneaza: string;
    efort: "mic" | "mediu" | "mare";
  }[];
  plan_30_zile: {
    saptamana: number;
    focus: string;
    actiuni: string[];
  }[];
  intrebari_pentru_client: string[];
}
