// Telegram botga kelgan xabarlar (webhook). Bot mantig'i: app/lib/bot.ts
import { NextRequest } from "next/server";
import { handleUpdate, type TgUpdate } from "../../../lib/bot";
import { siteUrlFrom, telegramConfigured, webhookSecret } from "../../../lib/telegram";

export async function POST(req: NextRequest) {
  if (!telegramConfigured()) return new Response("not configured", { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) {
    return new Response("forbidden", { status: 403 });
  }

  let update: TgUpdate = {};
  try {
    update = (await req.json()) as TgUpdate;
  } catch {}

  try {
    await handleUpdate(update, siteUrlFrom(req));
  } catch (err) {
    console.error("Bot xatosi:", err);
  }
  // Telegram'ga har doim 200 qaytariladi, aks holda u xabarni qayta-qayta yuboradi
  return Response.json({ ok: true });
}
