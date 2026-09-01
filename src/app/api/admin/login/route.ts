import { NextResponse } from "next/server";
import { checkPassword, clearSession, setSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();

  if (form.get("action") === "logout") {
    await clearSession();
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  const password = (form.get("password") as string | null) ?? "";
  if (!checkPassword(password)) {
    return NextResponse.redirect(new URL("/admin?eroare=1", request.url), 303);
  }

  await setSession();
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
