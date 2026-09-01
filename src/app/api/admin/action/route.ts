import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { deliver, runTick } from "@/lib/pipeline";
import { getLead, patchLead } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Actiunile din panou. Toate primesc `id`-ul leadului si redirectioneaza
 * inapoi la /admin, ca sa mearga si fara JavaScript.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  const form = await request.formData();
  const id = (form.get("id") as string | null) ?? "";
  const action = (form.get("action") as string | null) ?? "";

  // Rularea manuala a pipeline-ului nu tine de un lead anume.
  if (action === "run") {
    await runTick();
    return NextResponse.redirect(new URL("/admin?rulat=1", request.url), 303);
  }

  const lead = await getLead(id);

  if (!lead) {
    return NextResponse.redirect(new URL("/admin?eroare=lead", request.url), 303);
  }

  switch (action) {
    case "approve":
      // Aprobat: pleaca automat cand se implineste fereastra de livrare.
      await patchLead(lead, { status: "approved", error: "" });
      break;

    case "send_now":
      // Aprobat si cu fereastra mutata in trecut, apoi rulam livrarea imediat.
      await patchLead(lead, {
        status: "approved",
        deliverAfter: new Date(Date.now() - 1000).toISOString(),
        error: "",
      });
      await deliver();
      break;

    case "requeue":
      // Reface analiza de la zero, cu capturile aflate acum in Drive.
      await patchLead(lead, {
        status: "queued",
        batchId: "",
        docId: "",
        docUrl: "",
        error: "",
      });
      break;

    case "hold":
      await patchLead(lead, { status: "draft_ready", error: "" });
      break;

    default:
      return NextResponse.redirect(new URL("/admin?eroare=actiune", request.url), 303);
  }

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
