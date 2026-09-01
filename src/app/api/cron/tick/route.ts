import { NextResponse } from "next/server";
import { checkCronSecret, isAuthed } from "@/lib/auth";
import { runTick } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Punctul unic de intrare al automatizarii: dispatch -> collect -> deliver.
 *
 * E chemat de cron-ul din vercel.json din ora in ora. Pe planul Hobby, Vercel
 * permite un singur cron pe zi; in acel caz configurati un scheduler extern
 * (cron-job.org, Make, n8n) care sa apeleze /api/cron/tick?key=CRON_SECRET.
 *
 * Se poate rula si o singura faza: /api/cron/tick?phase=collect
 */
async function handle(request: Request) {
  if (!checkCronSecret(request) && !(await isAuthed())) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const phase = new URL(request.url).searchParams.get("phase") ?? undefined;
  if (phase && !["dispatch", "collect", "deliver"].includes(phase)) {
    return NextResponse.json({ error: `Faza necunoscuta: ${phase}` }, { status: 400 });
  }

  try {
    return NextResponse.json(await runTick(phase));
  } catch (err) {
    console.error("[cron] tick esuat:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
