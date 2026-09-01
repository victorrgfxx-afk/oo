import { isAuthed } from "@/lib/auth";
import { env } from "@/lib/env";
import { nicheLabel } from "@/lib/niches";
import { listLeads } from "@/lib/store";
import type { Lead, Status } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panou audituri" };

const STATUS_LABEL: Record<Status, string> = {
  new: "nou",
  awaiting_assets: "asteapta capturi",
  queued: "in coada",
  processing: "se analizeaza",
  draft_ready: "draft de verificat",
  approved: "aprobat",
  sent: "trimis",
  failed: "eroare",
};

function when(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionButton({
  id,
  action,
  label,
  strong,
}: {
  id: string;
  action: string;
  label: string;
  strong?: boolean;
}) {
  return (
    <form action="/api/admin/action" method="post">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={strong ? "strong" : undefined}>
        {label}
      </button>
    </form>
  );
}

function Actions({ lead }: { lead: Lead }) {
  return (
    <div className="actions">
      {lead.folderUrl && (
        <a className="link-btn" href={lead.folderUrl} target="_blank" rel="noreferrer">
          Folder
        </a>
      )}
      {lead.docUrl && (
        <a className="link-btn" href={lead.docUrl} target="_blank" rel="noreferrer">
          Document
        </a>
      )}
      {lead.status === "draft_ready" && (
        <ActionButton id={lead.id} action="approve" label="Aproba" strong />
      )}
      {(lead.status === "draft_ready" || lead.status === "approved") && (
        <ActionButton id={lead.id} action="send_now" label="Trimite acum" />
      )}
      {lead.status === "approved" && (
        <ActionButton id={lead.id} action="hold" label="Opreste livrarea" />
      )}
      {["failed", "draft_ready", "awaiting_assets", "sent"].includes(lead.status) && (
        <ActionButton id={lead.id} action="requeue" label="Reia analiza" />
      )}
    </div>
  );
}

function LoginScreen({ configured, failed }: { configured: boolean; failed: boolean }) {
  return (
    <main className="wrap">
      <div className="login-card">
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Panou audituri</h1>
        {!configured ? (
          <p className="hint">
            ADMIN_PASSWORD nu e configurat. Adauga variabila in environment si reincarca.
          </p>
        ) : (
          <>
            <p className="hint">Introdu parola de echipa.</p>
            {failed && (
              <p className="alert error" role="alert">
                Parola gresita.
              </p>
            )}
            <form action="/api/admin/login" method="post">
              <div className="field">
                <label htmlFor="password">Parola</label>
                <input id="password" name="password" type="password" required autoFocus />
              </div>
              <button className="primary" type="submit">
                Intra
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (!(await isAuthed())) {
    return <LoginScreen configured={Boolean(env("ADMIN_PASSWORD"))} failed={params.eroare === "1"} />;
  }

  let leads: Lead[] = [];
  let loadError: string | null = null;
  try {
    leads = (await listLeads()).reverse();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const pending = leads.filter((l) =>
    ["new", "awaiting_assets", "queued", "processing", "draft_ready", "approved"].includes(l.status),
  ).length;

  return (
    <main className="wrap">
      <div className="admin-bar">
        <h1>
          Audituri <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pending} in lucru)</span>
        </h1>
        <div className="actions">
          <form action="/api/admin/action" method="post">
            <input type="hidden" name="action" value="run" />
            <button type="submit" className="strong">
              Ruleaza pipeline-ul acum
            </button>
          </form>
          <form action="/api/admin/login" method="post">
            <input type="hidden" name="action" value="logout" />
            <button type="submit">Iesi</button>
          </form>
        </div>
      </div>

      {params.rulat === "1" && <p className="hint">Pipeline-ul a rulat. Starile de mai jos sunt actualizate.</p>}

      {loadError && (
        <p className="alert error" role="alert">
          Nu am putut citi foaia de calcul: {loadError}
        </p>
      )}

      {!loadError && leads.length === 0 ? (
        <p className="empty">Inca nu a intrat nicio cerere.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cont</th>
                <th>Nisa</th>
                <th>Stare</th>
                <th>Primit</th>
                <th>Se livreaza</th>
                <th>Capturi</th>
                <th>Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>@{lead.username}</strong>
                    <br />
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{lead.email}</span>
                    {lead.error && (
                      <>
                        <br />
                        <span style={{ color: "var(--danger)", fontSize: 12.5 }}>{lead.error}</span>
                      </>
                    )}
                  </td>
                  <td>{nicheLabel(lead.niche)}</td>
                  <td>
                    <span className={`badge ${lead.status}`}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
                  </td>
                  <td>{when(lead.createdAt)}</td>
                  <td>{lead.status === "sent" ? when(lead.sentAt) : when(lead.deliverAfter)}</td>
                  <td>{lead.screenshotCount || "-"}</td>
                  <td>
                    <Actions lead={lead} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
