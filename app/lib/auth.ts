// Admin kirishi: ADMIN_PASSWORD (.env.local) + imzolangan httpOnly cookie.
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const COOKIE = "nc_admin";
export const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 kun

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret(): string {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function makeToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token?: string): boolean {
  if (!token || !adminConfigured()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(COOKIE)?.value);
}

export function checkPassword(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  const h = (s: string) => createHmac("sha256", "nc-pw").update(s).digest();
  return timingSafeEqual(h(input), h(real));
}

export const unauthorized = () =>
  Response.json({ error: "Avval tizimga kiring." }, { status: 401 });
