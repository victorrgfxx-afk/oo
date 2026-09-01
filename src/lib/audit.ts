import Anthropic from "@anthropic-ai/sdk";
import { env, requireEnv } from "./env";
import { readDocText } from "./google";
import { getNiche, nicheLabel } from "./niches";
import type { AuditResult, Lead } from "./types";

/**
 * Agentul de audit.
 *
 * Ruleaza prin Message Batches API, nu prin request sincron, din doua motive:
 *  - costa 50% din pretul normal;
 *  - livrarea e oricum la 48h, deci latenta de pana la 24h nu ne deranjeaza.
 */

export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

/** Tipurile de imagine acceptate de API. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function isSupportedImage(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType);
}

/**
 * Playbook-ul nisei: textul din cod, plus - daca e configurat un Google Doc -
 * continutul acelui doc. Asa poate echipa sa "antreneze" agentul fara deploy.
 */
export async function loadPlaybook(nicheId: string): Promise<string> {
  const niche = getNiche(nicheId);
  if (!niche) throw new Error(`Nisa necunoscuta: ${nicheId}`);

  const docId = env(niche.kbDocEnv);
  if (!docId) return niche.playbook;

  try {
    const extra = (await readDocText(docId)).trim();
    if (!extra) return niche.playbook;
    return `${niche.playbook}\n\n## Completari de la echipa\n${extra}\n`;
  } catch (err) {
    // Un doc inaccesibil nu trebuie sa blocheze auditul.
    console.error(`Nu am putut citi playbook-ul din Doc (${niche.kbDocEnv}):`, err);
    return niche.playbook;
  }
}

const SYSTEM_PROMPT = `Esti social media manager senior, cu peste zece ani de experienta pe conturi de business mici si medii din Romania. Ai construit conturi de la zero in nisele beauty, HoReCa, fitness si imobiliare, si stii ce aduce clienti, nu doar aprecieri.

Faci un audit platit pentru un client real. Documentul ajunge in fata lui, asa ca scrie ca un consultant care isi pune numele pe treaba asta.

REGULI DE FOND
1. Ai la dispozitie DOAR capturi de ecran ale profilului. Nu ai acces la statistici interne, la rata de engagement reala sau la istoricul contului. Nu inventa cifre. Daca un numar nu e vizibil in capturi, spune explicit ca nu se vede si formuleaza ca ipoteza ("din ce se vede in grid, pare ca...").
2. Fii concret. "Posteaza mai des" si "fii consecvent" nu sunt sfaturi. "Muta cele trei postari cu poster in Canva din grid si inlocuieste-le cu close-up-uri filmate la fereastra, dimineata" este.
3. Refera-te la ce vezi efectiv: culorile din grid, textul din bio, formatul postarilor, ordinea highlight-urilor, calitatea luminii. Detaliul concret e ce diferentiaza auditul asta de un text generat.
4. Tot ce recomanzi trebuie sa poata fi executat de un om cu un telefon, fara echipa de productie si fara buget de reclama.
5. Scrie in romana, la persoana a doua ("contul tau"), pe un ton direct si colegial. Fara jargon corporatist, fara "sinergii", fara "strategie omnichannel". Diacriticele sunt optionale, dar fii consecvent.
6. Cand semnalezi o problema, spune si de ce conteaza in bani sau in clienti pierduti, nu doar ca "nu arata bine".
7. Daca vezi un risc real - promisiuni medicale sau de slabit riscante, date personale vizibile, poze folosite fara drept, lipsa unor mentiuni legale - semnaleaza-l ca problema de prioritate mare.
8. Daca capturile sunt insuficiente sau ilizibile, spune asta clar in "prima_impresie" si pune in "intrebari_pentru_client" exact ce mai ai nevoie. Nu compensa prin generalitati.

DESPRE IDEILE DE CONTINUT
Dai exact 12 idei, ancorate in playbook-ul nisei pe care il primesti si adaptate la ce vezi la acest cont anume. Fiecare idee trebuie sa fie o postare pe care clientul o poate filma saptamana asta. Hook-ul e prima replica rostita sau primul text pe ecran, scris cuvant cu cuvant. Nu repeta acelasi format de 12 ori: amesteca reels, carusele si postari statice, si acopera mai multi piloni de continut.

DESPRE COPY
Pentru numele afisat si pentru bio dai cate trei variante scrise complet, gata de copiat, cu un motiv scurt pentru fiecare. Numele afisat trebuie sa contina serviciul si orasul, pentru ca e camp cautabil. Bio-ul trebuie sa incapa in limita platformei (aproximativ 150 de caractere pe Instagram).

Raspunzi exclusiv prin schema JSON ceruta.`;

/** Schema stricta a raspunsului. Structured outputs cere required + additionalProperties:false. */
const AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "scor_general",
    "scoruri",
    "prima_impresie",
    "puncte_forte",
    "probleme",
    "copy",
    "idei_continut",
    "plan_30_zile",
    "intrebari_pentru_client",
  ],
  properties: {
    scor_general: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Scor global al profilului.",
    },
    scoruri: {
      type: "object",
      additionalProperties: false,
      required: [
        "bio_si_pozitionare",
        "identitate_vizuala",
        "calitate_continut",
        "engagement_si_comunitate",
        "conversie",
      ],
      properties: {
        bio_si_pozitionare: { type: "integer", minimum: 0, maximum: 100 },
        identitate_vizuala: { type: "integer", minimum: 0, maximum: 100 },
        calitate_continut: { type: "integer", minimum: 0, maximum: 100 },
        engagement_si_comunitate: { type: "integer", minimum: 0, maximum: 100 },
        conversie: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    prima_impresie: {
      type: "string",
      description:
        "Doua-trei paragrafe: ce intelege un strain despre business in primele cinci secunde pe profil.",
    },
    puncte_forte: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" },
    },
    probleme: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titlu", "de_ce_conteaza", "cum_repari", "prioritate"],
        properties: {
          titlu: { type: "string" },
          de_ce_conteaza: { type: "string" },
          cum_repari: {
            type: "string",
            description: "Pasii concreti, executabili in aceasta saptamana.",
          },
          prioritate: { type: "string", enum: ["mare", "medie", "mica"] },
        },
      },
    },
    copy: {
      type: "object",
      additionalProperties: false,
      required: ["nume_afisat", "bio", "call_to_action", "highlights"],
      properties: {
        nume_afisat: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["varianta", "motiv"],
            properties: {
              varianta: { type: "string" },
              motiv: { type: "string" },
            },
          },
        },
        bio: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["varianta", "motiv"],
            properties: {
              varianta: { type: "string" },
              motiv: { type: "string" },
            },
          },
        },
        call_to_action: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
        highlights: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: { type: "string" },
          description: "Denumiri propuse pentru highlight-uri / sectiuni fixate.",
        },
      },
    },
    idei_continut: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "titlu",
          "format",
          "hook",
          "structura",
          "cta",
          "de_ce_functioneaza",
          "efort",
        ],
        properties: {
          titlu: { type: "string" },
          format: {
            type: "string",
            description: "Ex: Reel 10s, carusel 5 slide-uri, postare statica, story.",
          },
          hook: {
            type: "string",
            description: "Prima replica sau primul text pe ecran, scris cuvant cu cuvant.",
          },
          structura: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string" },
            description: "Cadrele sau slide-urile, pe rand.",
          },
          cta: { type: "string" },
          de_ce_functioneaza: { type: "string" },
          efort: { type: "string", enum: ["mic", "mediu", "mare"] },
        },
      },
    },
    plan_30_zile: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["saptamana", "focus", "actiuni"],
        properties: {
          saptamana: { type: "integer", minimum: 1, maximum: 4 },
          focus: { type: "string" },
          actiuni: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
        },
      },
    },
    intrebari_pentru_client: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" },
      description: "Ce nu se poate deduce din capturi si ar schimba recomandarile.",
    },
  },
} as const;

export interface ScreenshotInput {
  name: string;
  mimeType: string;
  data: Uint8Array;
}

/** Construieste request-ul de batch pentru un lead. `custom_id` = id-ul leadului. */
export async function buildAuditRequest(
  lead: Lead,
  screenshots: ScreenshotInput[],
): Promise<Anthropic.Messages.Batches.BatchCreateParams.Request> {
  const playbook = await loadPlaybook(lead.niche);

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  content.push({
    type: "text",
    text: `# Playbook intern pentru nisa: ${nicheLabel(lead.niche)}\n\nFoloseste-l ca reper pentru ce functioneaza in nisa, dar adapteaza totul la contul concret din capturi.\n\n${playbook}`,
  });

  content.push({
    type: "text",
    text: [
      "# Datele clientului",
      `- Nume / business: ${lead.name || "(nedeclarat)"}`,
      `- Username: @${lead.username}`,
      `- Platforme: ${lead.platforms.join(", ") || "nedeclarat"}`,
      `- Nisa: ${nicheLabel(lead.niche)}`,
      `- Site: ${lead.website || "(niciunul)"}`,
      `- Ce a scris clientul despre situatia lui: ${lead.notes || "(nimic)"}`,
      "",
      `Urmeaza ${screenshots.length} capturi de ecran ale profilului.`,
    ].join("\n"),
  });

  for (const shot of screenshots) {
    content.push({ type: "text", text: `Captura: ${shot.name}` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: shot.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: Buffer.from(shot.data).toString("base64"),
      },
    });
  }

  content.push({
    type: "text",
    text: "Fa auditul complet si returneaza JSON-ul conform schemei.",
  });

  return {
    custom_id: lead.id,
    params: {
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: AUDIT_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [{ role: "user", content }],
    },
  };
}

/**
 * Extrage rezultatul dintr-un mesaj de batch. Cu structured outputs raspunsul
 * e deja JSON valid, dar parsam tolerant ca sa nu pierdem un audit daca modelul
 * imbraca JSON-ul in text sau intr-un bloc de cod.
 */
export function parseAuditResult(message: Anthropic.Messages.Message): AuditResult {
  const text = message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Raspunsul modelului nu contine text.");
  }

  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.startsWith("{")) candidates.push(braced);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim()) as AuditResult;
    } catch {
      // incercam urmatorul candidat
    }
  }
  throw new Error(`Nu am putut parsa JSON-ul din raspuns: ${text.slice(0, 300)}`);
}
