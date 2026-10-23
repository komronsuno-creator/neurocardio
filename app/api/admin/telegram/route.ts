// Admin: Telegram botni bir tugma bilan sozlash (webhook, "Ochish" menyu tugmasi, tavsiflar, buyruqlar).
import { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { readData } from "../../../lib/store";
import { getDoctorLinks, siteUrlFrom, telegramConfigured, tgApi, webhookSecret } from "../../../lib/telegram";

type Me = { username: string; first_name: string };
type WebhookInfo = { url: string; last_error_message?: string; pending_update_count?: number };

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  if (!telegramConfigured()) return Response.json({ configured: false });

  const [me, hook, links, { doctors }] = await Promise.all([
    tgApi<Me>("getMe"),
    tgApi<WebhookInfo>("getWebhookInfo"),
    getDoctorLinks(),
    readData(),
  ]);
  return Response.json(
    {
      configured: true,
      reachable: Boolean(me),
      bot: me?.username ?? null,
      webhook: hook?.url ?? "",
      webhookError: hook?.last_error_message ?? "",
      site: siteUrlFrom(req),
      linkedDoctors: doctors.filter((d) => links[d.id]).map((d) => d.name),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  if (!telegramConfigured()) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN o‘rnatilmagan. Netlify → Environment variables bo‘limiga qo‘shib, qayta deploy qiling." },
      { status: 503 },
    );
  }

  const site = siteUrlFrom(req);
  if (!site.startsWith("https://")) {
    return Response.json(
      { error: "Telegram faqat https:// manzil bilan ishlaydi. Botni saytning haqiqiy manzilidan (Netlify) sozlang." },
      { status: 400 },
    );
  }

  const steps: { name: string; ok: boolean }[] = [];
  const run = async (name: string, method: string, payload: Record<string, unknown>) => {
    steps.push({ name, ok: Boolean(await tgApi(method, payload)) });
  };

  await run("Webhook (bot xabarlari saytga keladi)", "setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await run("Menyu tugmasi (Mini App)", "setChatMenuButton", {
    menu_button: { type: "web_app", text: "NeyroCardio", web_app: { url: `${site}/` } },
  });
  await run("Buyruqlar (UZ)", "setMyCommands", {
    commands: [
      { command: "start", description: "Bosh menyu" },
      { command: "ask", description: "Shifokorga yozish" },
      { command: "book", description: "Qabulga yozilish" },
      { command: "doctors", description: "Shifokorlar" },
      { command: "videos", description: "Foydali videolar" },
      { command: "contacts", description: "Aloqa" },
      { command: "location", description: "Qabul manzili (xarita)" },
      { command: "lang", description: "Tilni almashtirish / Сменить язык" },
      { command: "stop", description: "Suhbatni tugatish" },
    ],
  });
  await run("Buyruqlar (RU)", "setMyCommands", {
    commands: [
      { command: "start", description: "Главное меню" },
      { command: "ask", description: "Написать врачу" },
      { command: "book", description: "Записаться на приём" },
      { command: "doctors", description: "Врачи" },
      { command: "videos", description: "Полезные видео" },
      { command: "contacts", description: "Контакты" },
      { command: "location", description: "Адрес приёма (карта)" },
      { command: "lang", description: "Сменить язык / Tilni almashtirish" },
      { command: "stop", description: "Завершить чат" },
    ],
    language_code: "ru",
  });
  await run("Qisqa tavsif (UZ)", "setMyShortDescription", {
    short_description: "Nevrologiya va kardiologiya: shifokorlardan ishonchli ma’lumot, savol-javob va qabulga yozilish.",
  });
  await run("Qisqa tavsif (RU)", "setMyShortDescription", {
    short_description: "Неврология и кардиология: информация от врачей, вопросы врачу и запись на приём.",
    language_code: "ru",
  });
  await run("Tavsif (UZ)", "setMyDescription", {
    description:
      "NeyroCardio — nevrolog va kardiolog shifokorlarning rasmiy boti.\n\n• Foydali tibbiy videolar\n• Shifokorga savol berish\n• Qabulga yozilish\n\nBoshlash uchun “Start” tugmasini bosing.",
  });
  await run("Tavsif (RU)", "setMyDescription", {
    description:
      "NeyroCardio — официальный бот врачей-невролога и кардиолога.\n\n• Полезные медицинские видео\n• Вопрос врачу\n• Запись на приём\n\nНажмите «Старт», чтобы начать.",
    language_code: "ru",
  });

  const ok = steps.every((s) => s.ok);
  return Response.json({ ok, site, steps }, { status: ok ? 200 : 502 });
}
