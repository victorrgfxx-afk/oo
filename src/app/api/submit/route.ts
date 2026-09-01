import { NextResponse } from "next/server";
import { z } from "zod";
import { deliveryDelayHours, envInt, requireEnv } from "@/lib/env";
import { createFolder, folderUrl, uploadFile } from "@/lib/google";
import { confirmationEmail, notifyTeam, sendEmail } from "@/lib/mail";
import { NICHE_IDS, nicheLabel } from "@/lib/niches";
import { insertLead, newId } from "@/lib/store";
import type { Lead, Platform } from "@/lib/types";
import { isSupportedImage } from "@/lib/audit";
import { folderName, normalizeUsername } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 8;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

const schema = z.object({
  niche: z.enum(NICHE_IDS),
  email: z.string().email("Adresa de email nu pare valida."),
  username: z.string().min(1, "Completeaza username-ul.").max(64),
  name: z.string().max(120).optional().default(""),
  website: z.string().max(200).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  platforms: z.array(z.enum(["instagram", "tiktok", "facebook"])).min(1, "Alege cel putin o platforma."),
  consent: z.literal("da", { errorMap: () => ({ message: "E nevoie de acord ca sa te putem contacta." }) }),
});

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cerere invalida." }, { status: 400 });
  }

  // Honeypot: campul e ascuns in formular, deci doar boti il completeaza.
  if ((form.get("company") as string | null)?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const parsed = schema.safeParse({
    niche: form.get("niche"),
    email: (form.get("email") as string | null)?.trim(),
    username: form.get("username"),
    name: (form.get("name") as string | null) ?? "",
    website: (form.get("website") as string | null) ?? "",
    notes: (form.get("notes") as string | null) ?? "",
    platforms: form.getAll("platforms"),
    consent: form.get("consent"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const username = normalizeUsername(data.username);
  if (!username) {
    return NextResponse.json({ error: "Username-ul nu pare valid." }, { status: 400 });
  }

  const files = form
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Fisierul ${file.name} e prea mare (maximum 6 MB).` },
        { status: 400 },
      );
    }
    if (!isSupportedImage(file.type)) {
      return NextResponse.json(
        { error: `Formatul ${file.name} nu e acceptat. Trimite JPG, PNG sau WEBP.` },
        { status: 400 },
      );
    }
  }

  try {
    const parent = requireEnv("GOOGLE_DRIVE_PARENT_FOLDER_ID");
    const folder = await createFolder(parent, folderName(username, nicheLabel(data.niche)));
    const assets = await createFolder(folder.id, "01-capturi");

    let uploaded = 0;
    for (const [i, file] of files.entries()) {
      const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const bytes = new Uint8Array(await file.arrayBuffer());
      await uploadFile(
        assets.id,
        `${String(i + 1).padStart(2, "0")}-${file.name.replace(/[\\/]/g, "-") || `captura.${ext}`}`,
        file.type,
        bytes,
      );
      uploaded += 1;
    }

    const now = new Date();
    const lead: Lead = {
      id: newId(),
      createdAt: now.toISOString(),
      status: uploaded > 0 ? "queued" : "awaiting_assets",
      niche: data.niche,
      platforms: data.platforms as Platform[],
      username,
      email: data.email,
      name: data.name.trim(),
      website: data.website.trim(),
      notes: data.notes.trim(),
      folderId: folder.id,
      folderUrl: folderUrl(folder.id),
      assetsFolderId: assets.id,
      screenshotCount: uploaded,
      batchId: "",
      docId: "",
      docUrl: "",
      deliverAfter: new Date(
        now.getTime() + deliveryDelayHours() * 3600_000,
      ).toISOString(),
      sentAt: "",
      error: "",
    };

    await insertLead(lead);

    const hours = envInt("DELIVERY_DELAY_HOURS", 48);
    const { subject, html } = confirmationEmail(lead, hours);
    await sendEmail({ to: lead.email, toName: lead.name || undefined, subject, html }).catch(
      (err) => console.error("[submit] confirmarea nu a plecat:", err),
    );
    await notifyTeam(lead, "nou");

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("[submit] esuat:", err);
    return NextResponse.json(
      { error: "Nu am putut inregistra cererea. Incearca din nou in cateva minute." },
      { status: 500 },
    );
  }
}
