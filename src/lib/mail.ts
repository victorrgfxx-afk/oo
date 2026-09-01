import { env, requireEnv, siteUrl } from "./env";
import { nicheLabel } from "./niches";
import type { Lead } from "./types";

/** Trimitere de email tranzactional prin Brevo. */

interface SendArgs {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(args: SendArgs): Promise<void> {
  const apiKey = env("BREVO_API_KEY");
  if (!apiKey) {
    // In dev, fara cheie, doar logam - restul fluxului trebuie sa mearga.
    console.warn(`[mail] BREVO_API_KEY lipseste; nu trimit "${args.subject}" catre ${args.to}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: requireEnv("MAIL_FROM_EMAIL"),
        name: env("MAIL_FROM_NAME") ?? "Audit social media",
      },
      to: [{ email: args.to, ...(args.toName ? { name: args.toName } : {}) }],
      ...(args.replyTo ? { replyTo: { email: args.replyTo } } : {}),
      subject: args.subject,
      htmlContent: args.html,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/* -------------------------------- Sabloane -------------------------------- */

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="ro"><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0 16px;">
    <p style="margin:0;font-size:12px;color:#78716c;">
      ${env("MAIL_FROM_NAME") ?? "Audit social media"}
    </p>
  </div>
</body></html>`;
}

const P = `style="margin:0 0 14px;font-size:15px;line-height:1.6;"`;

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a></p>`;
}

/** Confirmarea trimisa clientului imediat dupa completarea formularului. */
export function confirmationEmail(lead: Lead, hours: number): { subject: string; html: string } {
  const needsAssets = lead.screenshotCount === 0;
  return {
    subject: `Am primit cererea de audit pentru @${lead.username}`,
    html: layout(
      `Am primit cererea ta, ${lead.name || `@${lead.username}`}`,
      `<p ${P}>Iti facem un audit al profilului de social media pe nisa <strong>${nicheLabel(lead.niche)}</strong> si ti-l trimitem pe mail in maximum <strong>${hours} de ore</strong>.</p>
       <p ${P}>Ce primesti: analiza profilului punct cu punct, variante de nume si bio gata de copiat, 12 idei de continut construite pentru nisa ta si un plan pe 30 de zile.</p>
       ${
         needsAssets
           ? `<p ${P}>Nu am primit capturi de ecran ale profilului. Le facem noi, dar daca vrei sa fim mai preciși, raspunde la acest email cu 3-6 capturi: profilul intreg, bio-ul si cateva postari recente.</p>`
           : `<p ${P}>Am primit capturile trimise de tine. Daca vrei sa mai adaugi ceva, raspunde direct la acest email.</p>`
       }
       <p ${P}>Nu trebuie sa faci nimic altceva. Iti scriem noi.</p>`,
    ),
  };
}

/** Livrarea finala catre client. */
export function deliveryEmail(lead: Lead): { subject: string; html: string } {
  return {
    subject: `Auditul profilului @${lead.username} e gata`,
    html: layout(
      "Auditul tau e gata",
      `<p ${P}>${lead.name ? `Salut, ${lead.name}!` : "Salut!"} Am terminat analiza profilului <strong>@${lead.username}</strong>.</p>
       <p ${P}>In document gasesti: unde pierzi clienti acum si cum repari, trei variante de nume afisat si trei de bio pe care le poti copia direct, 12 idei de continut pentru <strong>${nicheLabel(lead.niche)}</strong> cu hook scris cuvant cu cuvant, si un plan pe patru saptamani.</p>
       ${button(lead.docUrl, "Deschide auditul")}
       <p ${P}>Ia-le pe rand, in ordinea din document - sunt asezate de la ce are impact imediat catre ce construieste in timp.</p>
       <p ${P}>Daca ai intrebari pe ceva din document, raspunde direct la acest email.</p>`,
    ),
  };
}

/** Notificare interna pentru echipa. */
export function teamEmail(
  lead: Lead,
  kind: "nou" | "draft" | "eroare",
): { subject: string; html: string } {
  const admin = `${siteUrl()}/admin`;
  if (kind === "nou") {
    return {
      subject: `[lead] @${lead.username} - ${nicheLabel(lead.niche)}`,
      html: layout(
        `Cerere noua: @${lead.username}`,
        `<p ${P}>Nisa: ${nicheLabel(lead.niche)}<br>Platforme: ${lead.platforms.join(", ")}<br>Email: ${lead.email}<br>Capturi primite: ${lead.screenshotCount}</p>
         ${lead.notes ? `<p ${P}>Ce a scris: ${lead.notes}</p>` : ""}
         ${
           lead.screenshotCount === 0
             ? `<p ${P}><strong>Nu are capturi.</strong> Puneti-le in folderul de mai jos ca sa poata porni analiza.</p>`
             : ""
         }
         ${button(lead.folderUrl, "Deschide folderul in Drive")}
         <p ${P}><a href="${admin}">Panou de administrare</a></p>`,
      ),
    };
  }
  if (kind === "draft") {
    return {
      subject: `[draft gata] @${lead.username} - de verificat`,
      html: layout(
        `Draftul pentru @${lead.username} e gata`,
        `<p ${P}>Documentul e generat in Drive. Verificati-l, adaugati observatiile voastre, stergeti nota interna de la inceput, apoi aprobati-l din panou.</p>
         <p ${P}>Se livreaza clientului dupa ${lead.deliverAfter ? new Date(lead.deliverAfter).toLocaleString("ro-RO") : "fereastra configurata"}.</p>
         ${button(lead.docUrl, "Deschide documentul")}
         <p ${P}><a href="${admin}">Panou de administrare</a></p>`,
      ),
    };
  }
  return {
    subject: `[eroare] @${lead.username}`,
    html: layout(
      `Ceva a esuat la @${lead.username}`,
      `<p ${P}>${lead.error || "Eroare necunoscuta"}</p>
       <p ${P}><a href="${admin}">Panou de administrare</a></p>`,
    ),
  };
}

export async function notifyTeam(
  lead: Lead,
  kind: "nou" | "draft" | "eroare",
): Promise<void> {
  const to = env("TEAM_EMAIL");
  if (!to) return;
  const { subject, html } = teamEmail(lead, kind);
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    // Notificarea interna nu trebuie sa opreasca pipeline-ul.
    console.error("[mail] notificarea interna a esuat:", err);
  }
}
