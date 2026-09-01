import { anthropic, buildAuditRequest, isSupportedImage, parseAuditResult } from "./audit";
import type { ScreenshotInput } from "./audit";
import { deliveryDelayHours, envInt } from "./env";
import {
  createDoc,
  docUrl,
  downloadFile,
  listImages,
  shareWithLink,
  writeDocBlocks,
} from "./google";
import { deliveryEmail, notifyTeam, sendEmail } from "./mail";
import { renderAudit } from "./render";
import { listLeads, patchLead } from "./store";
import type { Lead } from "./types";

/**
 * Cele trei faze ale pipeline-ului. Sunt scrise ca sa poata rula oricat de des:
 * fiecare faza isi alege singura randurile pe care le are de procesat, iar o
 * eroare pe un lead nu opreste restul.
 */

export interface PhaseReport {
  faza: string;
  procesate: number;
  detalii: string[];
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Cate capturi trimitem modelului. Peste ~8 nu mai creste calitatea, doar costul. */
function maxScreenshots(): number {
  return envInt("MAX_SCREENSHOTS", 8);
}

/** Cate leaduri intra intr-un batch. Tine durata unui tick sub limita functiei. */
function maxLeadsPerTick(): number {
  return envInt("MAX_LEADS_PER_TICK", 15);
}

/* ------------------------------- Faza 1: dispatch ------------------------------ */

/**
 * Ia leadurile care au capturi si le trimite intr-un Message Batch.
 * Leadurile fara capturi sunt re-verificate la fiecare rulare: echipa poate
 * pune capturile direct in folderul din Drive si pornesc singure.
 */
export async function dispatch(): Promise<PhaseReport> {
  const detalii: string[] = [];
  const leads = await listLeads();

  const candidates = leads.filter(
    (l) => l.status === "queued" || l.status === "awaiting_assets" || l.status === "new",
  );

  const ready: { lead: Lead; screenshots: ScreenshotInput[] }[] = [];

  for (const lead of candidates.slice(0, maxLeadsPerTick())) {
    if (!lead.assetsFolderId) {
      detalii.push(`@${lead.username}: fara folder de capturi, sarit`);
      continue;
    }
    try {
      const images = (await listImages(lead.assetsFolderId))
        .filter((f) => isSupportedImage(f.mimeType))
        .slice(0, maxScreenshots());

      if (images.length === 0) {
        if (lead.status !== "awaiting_assets") {
          await patchLead(lead, { status: "awaiting_assets", screenshotCount: 0 });
        }
        detalii.push(`@${lead.username}: inca fara capturi`);
        continue;
      }

      const screenshots: ScreenshotInput[] = [];
      for (const image of images) {
        screenshots.push({
          name: image.name,
          mimeType: image.mimeType,
          data: await downloadFile(image.id),
        });
      }
      ready.push({ lead, screenshots });
    } catch (err) {
      detalii.push(`@${lead.username}: eroare la citirea capturilor - ${errText(err)}`);
      await patchLead(lead, { status: "failed", error: errText(err) }).catch(() => {});
    }
  }

  if (ready.length === 0) {
    return { faza: "dispatch", procesate: 0, detalii };
  }

  const requests = await Promise.all(
    ready.map(({ lead, screenshots }) => buildAuditRequest(lead, screenshots)),
  );

  const batch = await anthropic().messages.batches.create({ requests });
  detalii.push(`batch ${batch.id} creat cu ${requests.length} cereri`);

  for (const { lead, screenshots } of ready) {
    await patchLead(lead, {
      status: "processing",
      batchId: batch.id,
      screenshotCount: screenshots.length,
      error: "",
    });
  }

  return { faza: "dispatch", procesate: ready.length, detalii };
}

/* ------------------------------- Faza 2: collect ------------------------------ */

/** Verifica batch-urile in lucru si scrie documentele pentru cele terminate. */
export async function collect(): Promise<PhaseReport> {
  const detalii: string[] = [];
  const leads = await listLeads();
  const processing = leads.filter((l) => l.status === "processing" && l.batchId);

  const batchIds = [...new Set(processing.map((l) => l.batchId))];
  let procesate = 0;

  for (const batchId of batchIds) {
    let batch;
    try {
      batch = await anthropic().messages.batches.retrieve(batchId);
    } catch (err) {
      detalii.push(`batch ${batchId}: nu l-am putut citi - ${errText(err)}`);
      continue;
    }

    if (batch.processing_status !== "ended") {
      detalii.push(`batch ${batchId}: inca ruleaza`);
      continue;
    }

    const byId = new Map(processing.filter((l) => l.batchId === batchId).map((l) => [l.id, l]));

    for await (const entry of await anthropic().messages.batches.results(batchId)) {
      const lead = byId.get(entry.custom_id);
      if (!lead) continue;

      if (entry.result.type !== "succeeded") {
        const reason =
          entry.result.type === "errored"
            ? JSON.stringify(entry.result.error).slice(0, 300)
            : entry.result.type;
        const failed = await patchLead(lead, { status: "failed", error: reason });
        await notifyTeam(failed, "eroare");
        detalii.push(`@${lead.username}: ${reason}`);
        continue;
      }

      try {
        const audit = parseAuditResult(entry.result.message);
        const doc = await createDoc(lead.folderId, `Audit - @${lead.username}`);
        await writeDocBlocks(doc.id, renderAudit(lead, audit));

        const updated = await patchLead(lead, {
          status: "draft_ready",
          docId: doc.id,
          docUrl: docUrl(doc.id),
          error: "",
        });
        await notifyTeam(updated, "draft");
        procesate += 1;
        detalii.push(`@${lead.username}: draft scris`);
      } catch (err) {
        const failed = await patchLead(lead, { status: "failed", error: errText(err) });
        await notifyTeam(failed, "eroare");
        detalii.push(`@${lead.username}: eroare la scrierea documentului - ${errText(err)}`);
      }
    }
  }

  return { faza: "collect", procesate, detalii };
}

/* ------------------------------- Faza 3: deliver ------------------------------ */

/**
 * Trimite auditele aprobate care si-au implinit fereastra de livrare.
 * Aprobarea e manuala (din panou), fereastra e automata - asa clientul
 * primeste mereu la acelasi interval, indiferent cand a apucat echipa sa editeze.
 */
export async function deliver(): Promise<PhaseReport> {
  const detalii: string[] = [];
  const leads = await listLeads();
  const now = Date.now();

  const due = leads.filter((l) => {
    if (l.status !== "approved" || !l.docUrl) return false;
    if (!l.deliverAfter) return true;
    const at = new Date(l.deliverAfter).getTime();
    return Number.isNaN(at) || at <= now;
  });

  let procesate = 0;
  for (const lead of due) {
    try {
      // Documentul trebuie sa fie deschis pentru cine are linkul, altfel
      // clientul primeste un email cu un link la care nu are acces.
      if (lead.docId) await shareWithLink(lead.docId);

      const { subject, html } = deliveryEmail(lead);
      await sendEmail({
        to: lead.email,
        toName: lead.name || undefined,
        subject,
        html,
      });
      await patchLead(lead, {
        status: "sent",
        sentAt: new Date().toISOString(),
        error: "",
      });
      procesate += 1;
      detalii.push(`@${lead.username}: trimis la ${lead.email}`);
    } catch (err) {
      await patchLead(lead, { error: errText(err) }).catch(() => {});
      detalii.push(`@${lead.username}: livrare esuata - ${errText(err)}`);
    }
  }

  return { faza: "deliver", procesate, detalii };
}

/* ---------------------------------- Tick ---------------------------------- */

export interface TickReport {
  rulatLa: string;
  ferestraOre: number;
  faze: PhaseReport[];
}

/** Ruleaza toate fazele, in ordine. Apelat de cron. */
export async function runTick(only?: string): Promise<TickReport> {
  const faze: PhaseReport[] = [];
  const phases: Record<string, () => Promise<PhaseReport>> = {
    dispatch,
    collect,
    deliver,
  };

  for (const [name, fn] of Object.entries(phases)) {
    if (only && only !== name) continue;
    try {
      faze.push(await fn());
    } catch (err) {
      faze.push({ faza: name, procesate: 0, detalii: [`eroare: ${errText(err)}`] });
    }
  }

  return {
    rulatLa: new Date().toISOString(),
    ferestraOre: deliveryDelayHours(),
    faze,
  };
}
