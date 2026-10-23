// Telegram bot va Mini App bilan ishlash (faqat serverda).
// Token faqat muhit o'zgaruvchisida: TELEGRAM_BOT_TOKEN (Netlify → Environment variables, kompyuterda .env.local).
import { createHmac, timingSafeEqual } from "crypto";
import { kvGet, kvSet } from "./store";

export type TgUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  allows_write_to_pm?: boolean;
};

const token = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim();
export const telegramConfigured = () => Boolean(token());

/** Webhook so'rovlari haqiqatan Telegram'dan kelganini tekshirish uchun maxfiy kalit (tokendan olinadi). */
export function webhookSecret(): string {
  return createHmac("sha256", "nc-webhook").update(token()).digest("hex").slice(0, 48);
}

/** Telegram Bot API chaqiruvi. Xato bo'lsa null qaytaradi (sayt ishlashiga xalaqit bermaydi). */
export async function tgApi<T = unknown>(method: string, payload: Record<string, unknown> = {}): Promise<T | null> {
  if (!telegramConfigured()) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error(`Telegram ${method} xatosi:`, data.description);
      return null;
    }
    return data.result ?? (true as unknown as T);
  } catch (err) {
    console.error(`Telegram ${method} ga ulanib bo'lmadi:`, err);
    return null;
  }
}

/**
 * Mini App yuborgan initData ni tekshiradi (Telegram rasmiy usuli: HMAC-SHA256).
 * To'g'ri bo'lsa foydalanuvchini qaytaradi, aks holda null. 24 soatdan eski ma'lumot qabul qilinmaydi.
 */
export function verifyInitData(initData: unknown, maxAgeSeconds = 24 * 60 * 60): TgUser | null {
  if (typeof initData !== "string" || !initData || !telegramConfigured()) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  params.delete("hash");

  const checkString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token()).digest();
  const want = createHmac("sha256", secret).update(checkString).digest();
  const got = Buffer.from(hash, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TgUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

export const tgFullName = (u: TgUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 40);

/* ---------- Shifokor ↔ Telegram bog'lanishi ---------- */

const LINKS_KEY = "tg-links"; // { [doctorId]: telegramUserId }

export async function getDoctorLinks(): Promise<Record<string, number>> {
  return (await kvGet<Record<string, number>>(LINKS_KEY)) ?? {};
}

export async function linkDoctor(doctorId: string, tgUserId: number | null): Promise<void> {
  const links = await getDoctorLinks();
  // Bitta Telegram akkaunti faqat bitta shifokorga bog'lanadi
  for (const [id, uid] of Object.entries(links)) if (uid === tgUserId) delete links[id];
  if (tgUserId === null) delete links[doctorId];
  else links[doctorId] = tgUserId;
  await kvSet(LINKS_KEY, links);
}

export async function doctorIdByTelegram(tgUserId: number): Promise<string | null> {
  const links = await getDoctorLinks();
  const hit = Object.entries(links).find(([, uid]) => uid === tgUserId);
  return hit ? hit[0] : null;
}

/* ---------- Xabarlar ---------- */

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const html = (s: string) => escapeHtml(s);

/** Mini App'ni ochadigan tugma (sayt manzili kerak). */
export const openButton = (siteUrl: string, text: string, path = "/") => ({
  inline_keyboard: [[{ text, web_app: { url: new URL(path, siteUrl).toString() } }]],
});

export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown): Promise<boolean> {
  const res = await tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return Boolean(res);
}

/** Sayt manzili: Netlify'da URL o'zgaruvchisi, bo'lmasa so'rov kelgan manzil. */
export function siteUrlFrom(req: Request): string {
  const fromEnv = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");
  if (fromEnv.startsWith("https://")) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Bot username (bir marta so'raladi va eslab qolinadi). */
let botName: string | null = null;
export async function botUsername(): Promise<string | null> {
  if (botName || !telegramConfigured()) return botName;
  const me = await tgApi<{ username: string }>("getMe");
  botName = me?.username ?? null;
  return botName;
}
