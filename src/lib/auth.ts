import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

/**
 * Autentificare minimala pentru panoul intern: o singura parola, tinuta in
 * ADMIN_PASSWORD, schimbata pe un cookie semnat. Suficient pentru un panou
 * folosit de doi-trei oameni; daca ajunge sa fie folosit de mai multi, aici
 * se inlocuieste cu un provider real.
 */

const COOKIE = "audit_admin";

function token(password: string): string {
  return crypto.createHmac("sha256", password).update("admin-v1").digest("hex");
}

export function checkPassword(candidate: string): boolean {
  const expected = env("ADMIN_PASSWORD");
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setSession(): Promise<void> {
  const password = env("ADMIN_PASSWORD");
  if (!password) throw new Error("ADMIN_PASSWORD nu e configurat.");
  const store = await cookies();
  store.set(COOKIE, token(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  const password = env("ADMIN_PASSWORD");
  if (!password) return false;
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return false;
  const expected = token(password);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verifica secretul folosit de cron (header de la Vercel sau ?key=). */
export function checkCronSecret(request: Request): boolean {
  const secret = env("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(request.url).searchParams.get("key");
  return key === secret;
}
