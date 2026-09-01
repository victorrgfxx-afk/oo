import type { DocBlock } from "./google";
import { nicheLabel } from "./niches";
import type { AuditResult, Lead } from "./types";

const PRIORITY_ORDER = { mare: 0, medie: 1, mica: 2 } as const;

const PRIORITY_LABEL = {
  mare: "Prioritate mare",
  medie: "Prioritate medie",
  mica: "Prioritate mica",
} as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Transforma rezultatul modelului in blocuri de Google Docs.
 *
 * Primul bloc e o nota interna pe care echipa o sterge inainte de trimitere -
 * documentul e un draft de lucru, nu un livrabil final.
 */
export function renderAudit(lead: Lead, audit: AuditResult): DocBlock[] {
  const blocks: DocBlock[] = [];

  blocks.push({ t: "h1", text: `Audit social media - @${lead.username}` });
  blocks.push({
    t: "p",
    text: `${nicheLabel(lead.niche)}  |  ${lead.platforms.join(", ") || "-"}  |  ${formatDate(lead.createdAt)}`,
  });

  blocks.push({
    t: "p",
    bold: true,
    text:
      "[NOTA INTERNA - stergeti acest paragraf inainte de trimitere] Draft generat automat pe baza capturilor de ecran. " +
      "Verificati afirmatiile despre cifre, adaugati observatiile voastre si ajustati tonul inainte de a trimite clientului.",
  });

  /* ------------------------------- Scoruri ------------------------------- */
  blocks.push({ t: "h2", text: "Pe scurt" });
  blocks.push({ t: "p", bold: true, text: `Scor general: ${audit.scor_general}/100` });
  const s = audit.scoruri;
  blocks.push({ t: "bullet", text: `Bio si pozitionare: ${s.bio_si_pozitionare}/100` });
  blocks.push({ t: "bullet", text: `Identitate vizuala: ${s.identitate_vizuala}/100` });
  blocks.push({ t: "bullet", text: `Calitatea continutului: ${s.calitate_continut}/100` });
  blocks.push({ t: "bullet", text: `Engagement si comunitate: ${s.engagement_si_comunitate}/100` });
  blocks.push({ t: "bullet", text: `Conversie (vizitator -> client): ${s.conversie}/100` });

  /* ---------------------------- Prima impresie ---------------------------- */
  blocks.push({ t: "h2", text: "Prima impresie" });
  for (const para of audit.prima_impresie.split(/\n{2,}/)) {
    if (para.trim()) blocks.push({ t: "p", text: para.trim() });
  }

  /* ------------------------------ Puncte forte ---------------------------- */
  blocks.push({ t: "h2", text: "Ce merge deja bine" });
  for (const item of audit.puncte_forte) {
    blocks.push({ t: "bullet", text: item });
  }

  /* -------------------------------- Probleme ------------------------------ */
  blocks.push({ t: "h2", text: "Ce te costa acum" });
  const sorted = [...audit.probleme].sort(
    (a, b) => PRIORITY_ORDER[a.prioritate] - PRIORITY_ORDER[b.prioritate],
  );
  sorted.forEach((problem, i) => {
    blocks.push({ t: "h3", text: `${i + 1}. ${problem.titlu}` });
    blocks.push({ t: "p", bold: true, text: PRIORITY_LABEL[problem.prioritate] });
    blocks.push({ t: "p", text: problem.de_ce_conteaza });
    blocks.push({ t: "p", text: `Cum repari: ${problem.cum_repari}` });
  });

  /* ---------------------------------- Copy -------------------------------- */
  blocks.push({ t: "h2", text: "Copy gata de folosit" });

  blocks.push({ t: "h3", text: "Nume afisat" });
  blocks.push({
    t: "p",
    text:
      "Numele afisat e camp cautabil pe Instagram si TikTok. Daca nu contine serviciul si orasul, " +
      "pierzi cautari care ti-ar aduce clienti locali.",
  });
  for (const option of audit.copy.nume_afisat) {
    blocks.push({ t: "bullet", text: `${option.varianta} - ${option.motiv}` });
  }

  blocks.push({ t: "h3", text: "Bio" });
  for (const option of audit.copy.bio) {
    blocks.push({ t: "bullet", text: `${option.varianta} - ${option.motiv}` });
  }

  blocks.push({ t: "h3", text: "Call to action" });
  for (const cta of audit.copy.call_to_action) {
    blocks.push({ t: "bullet", text: cta });
  }

  blocks.push({ t: "h3", text: "Highlights / sectiuni fixate" });
  for (const h of audit.copy.highlights) {
    blocks.push({ t: "bullet", text: h });
  }

  /* ----------------------------- Idei de continut ------------------------- */
  blocks.push({
    t: "h2",
    text: `${audit.idei_continut.length} idei de continut pentru ${nicheLabel(lead.niche).toLowerCase()}`,
  });
  audit.idei_continut.forEach((idea, i) => {
    blocks.push({ t: "h3", text: `${i + 1}. ${idea.titlu}` });
    blocks.push({ t: "p", text: `Format: ${idea.format}  |  Efort: ${idea.efort}` });
    blocks.push({ t: "p", bold: true, text: `Hook: "${idea.hook}"` });
    for (const step of idea.structura) {
      blocks.push({ t: "bullet", text: step });
    }
    blocks.push({ t: "p", text: `CTA: ${idea.cta}` });
    blocks.push({ t: "p", text: `De ce functioneaza: ${idea.de_ce_functioneaza}` });
  });

  /* ------------------------------ Plan 30 zile ---------------------------- */
  blocks.push({ t: "h2", text: "Plan pe 30 de zile" });
  for (const week of audit.plan_30_zile) {
    blocks.push({ t: "h3", text: `Saptamana ${week.saptamana}: ${week.focus}` });
    for (const action of week.actiuni) {
      blocks.push({ t: "bullet", text: action });
    }
  }

  /* -------------------------------- Intrebari ----------------------------- */
  blocks.push({ t: "h2", text: "Ce mai avem nevoie de la tine" });
  blocks.push({
    t: "p",
    text:
      "Auditul e facut doar pe baza capturilor de ecran. Raspunsurile la intrebarile " +
      "de mai jos ne-ar lasa sa fim mult mai precisi.",
  });
  for (const question of audit.intrebari_pentru_client) {
    blocks.push({ t: "bullet", text: question });
  }

  return blocks;
}
