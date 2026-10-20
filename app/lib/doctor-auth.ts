// Shifokorlar uchun alohida login/parol va sessiya.
// Akkauntlar "accounts" kalitida saqlanadi: { [doctorId]: { login, salt, hash } }.
// Parollar ochiq saqlanmaydi (scrypt xesh). Saytga hech qachon chiqarilmaydi.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { kvGet, kvSet } from "./store";

export const DOCTOR_COOKIE = "nc_doc";
export const DOCTOR_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 kun

type Account = { login: string; salt: string; hash: string };
type Accounts = Record<string, Account>;

const ACCOUNTS_KEY = "accounts";
export const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;

function secret(): string {
  const base = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
  return base ? `doctor:${base}` : "";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex");

async function readAccounts(): Promise<Accounts> {
  return (await kvGet<Accounts>(ACCOUNTS_KEY)) ?? {};
}

/** Admin uchun: har bir shifokorning logini (parolsiz). */
export async function listLogins(): Promise<Record<string, string>> {
  const all = await readAccounts();
  return Object.fromEntries(Object.entries(all).map(([id, a]) => [id, a.login]));
}

/**
 * Login va/yoki parolni o'rnatadi. Parol bo'sh bo'lsa eskisi qoladi.
 * Xato bo'lsa foydalanuvchiga ko'rsatiladigan matn qaytaradi.
 */
export async function setAccount(doctorId: string, loginRaw: string, password: string): Promise<string | null> {
  const login = loginRaw.trim().toLowerCase();
  if (!LOGIN_RE.test(login)) {
    return "Login 3–32 ta belgi bo‘lsin: lotin harflari, raqam, nuqta, chiziqcha.";
  }
  const all = await readAccounts();
  const taken = Object.entries(all).some(([id, a]) => id !== doctorId && a.login === login);
  if (taken) return "Bu login boshqa shifokorda bor. Boshqasini tanlang.";

  const current = all[doctorId];
  if (!current && !password) return "Yangi akkaunt uchun parol kiriting.";
  if (password && password.length < MIN_PASSWORD) return `Parol kamida ${MIN_PASSWORD} ta belgi bo‘lsin.`;

  if (password) {
    const salt = randomBytes(16).toString("hex");
    all[doctorId] = { login, salt, hash: hashPassword(password, salt) };
  } else {
    all[doctorId] = { ...current, login };
  }
  await kvSet(ACCOUNTS_KEY, all);
  return null;
}

export async function deleteAccount(doctorId: string): Promise<void> {
  const all = await readAccounts();
  if (!all[doctorId]) return;
  delete all[doctorId];
  await kvSet(ACCOUNTS_KEY, all);
}

/** Login va parol to'g'ri bo'lsa shifokor ID sini qaytaradi. */
export async function checkLogin(loginRaw: string, password: string): Promise<string | null> {
  const login = loginRaw.trim().toLowerCase();
  const all = await readAccounts();
  const entry = Object.entries(all).find(([, a]) => a.login === login);
  // Login topilmasa ham xesh hisoblanadi: javob vaqti bo'yicha loginni taxmin qilib bo'lmasin
  const salt = entry?.[1].salt ?? "0000000000000000";
  const got = Buffer.from(hashPassword(password, salt), "hex");
  if (!entry) return null;
  const want = Buffer.from(entry[1].hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want) ? entry[0] : null;
}

export function makeDoctorToken(doctorId: string): string {
  const exp = String(Math.floor(Date.now() / 1000) + DOCTOR_SESSION_SECONDS);
  return `${doctorId}.${exp}.${sign(`${doctorId}.${exp}`)}`;
}

/** Cookie'dagi sessiyadan shifokor ID si (yaroqsiz bo'lsa null). */
export function doctorIdFrom(req: NextRequest): string | null {
  if (!secret()) return null;
  const token = req.cookies.get(DOCTOR_COOKIE)?.value;
  if (!token) return null;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig) return null;
  if (!/^[a-z0-9]+$/i.test(id) || Number(exp) < Date.now() / 1000) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${id}.${exp}`));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

/** Oddiy urinishlar cheklovi (bitta server nusxasi doirasida). */
const attempts = new Map<string, { count: number; reset: number }>();
export function tooManyAttempts(key: string, limit = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.reset > now) {
    rec.count += 1;
    return rec.count > limit;
  }
  attempts.set(key, { count: 1, reset: now + windowMs });
  return false;
}
export const clearAttempts = (key: string) => attempts.delete(key);
