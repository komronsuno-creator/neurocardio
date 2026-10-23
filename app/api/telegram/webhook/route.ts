// Telegram botga kelgan xabarlar (webhook). Telegram har bir xabar va tugma bosilishini shu manzilga yuboradi.
// /start — animatsion salomlashuv (❤️ effekt bilan) va asosiy menyu: shifokor tanlash, savol berish, qabulga yozilish, videolar.
// Tugmalar bosilganda yangi xabar yuborilmaydi — o'sha xabarning o'zi almashadi (ilovadagidek silliq).
import { NextRequest } from "next/server";
import { kvGet, kvSet, readData } from "../../../lib/store";
import { doctorText } from "../../../lib/i18n";
import { html, siteUrlFrom, telegramConfigured, tgApi, webhookSecret } from "../../../lib/telegram";
import type { Doctor, Lang } from "../../../lib/types";

type From = { first_name?: string; language_code?: string };
type Update = {
  message?: { chat: { id: number; type: string }; from?: From; text?: string };
  callback_query?: {
    id: string;
    from: From & { id: number };
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

const T = {
  uz: {
    hello: (name: string) =>
      `Assalomu alaykum${name ? `, ${name}` : ""}! 👋\n\n<b>NeyroCardio</b> — nevrologiya va kardiologiya bo‘yicha shifokorlardan ishonchli ma’lumotlar.\n\nQuyidagilardan birini tanlang:`,
    doctors: "👨‍⚕️ Shifokorni tanlash",
    ask: "💬 Shifokorga savol berish",
    book: "📅 Qabulga yozilish",
    videos: "🎥 Foydali videolar",
    site: "🌐 Saytni ochish",
    chooseDoctor: "Qaysi shifokor kerak? Tanlang:",
    back: "« Orqaga",
    write: "✍️ Telegram’da yozish",
    bookThis: "📅 Shu shifokorga yozilish",
    phone: "📞 Telefon",
    exp: "Tajriba",
    sched: "Qabul vaqti",
    addr: "Manzil",
  },
  ru: {
    hello: (name: string) =>
      `Здравствуйте${name ? `, ${name}` : ""}! 👋\n\n<b>NeyroCardio</b> — достоверная информация о неврологии и кардиологии от врачей.\n\nВыберите, что вас интересует:`,
    doctors: "👨‍⚕️ Выбрать врача",
    ask: "💬 Задать вопрос врачу",
    book: "📅 Записаться на приём",
    videos: "🎥 Полезные видео",
    site: "🌐 Открыть сайт",
    chooseDoctor: "Какой врач вам нужен? Выберите:",
    back: "« Назад",
    write: "✍️ Написать в Telegram",
    bookThis: "📅 Записаться к этому врачу",
    phone: "📞 Телефон",
    exp: "Опыт",
    sched: "Часы приёма",
    addr: "Адрес",
  },
};

const langOf = (from?: From): Lang => ((from?.language_code ?? "").startsWith("ru") ? "ru" : "uz");
const app = (site: string, path: string) => ({ url: new URL(path, site).toString() });
const icon = (d: Doctor) => (d.accent === "cardio" ? "❤️" : "🧠");

function mainMenu(site: string, lang: Lang) {
  const t = T[lang];
  return {
    inline_keyboard: [
      [{ text: t.doctors, callback_data: "doctors" }],
      [{ text: t.ask, web_app: app(site, "/#savollar") }],
      [{ text: t.book, web_app: app(site, "/#qabul") }],
      [
        { text: t.videos, web_app: app(site, "/#videolar") },
        { text: t.site, web_app: app(site, "/") },
      ],
    ],
  };
}

function doctorsMenu(doctors: Doctor[], lang: Lang) {
  return {
    inline_keyboard: [
      ...doctors.map((d) => [
        {
          text: `${icon(d)} ${doctorText(d, "name", lang)} — ${doctorText(d, "role", lang)}`,
          callback_data: `doc:${d.id}`,
        },
      ]),
      [{ text: T[lang].back, callback_data: "home" }],
    ],
  };
}

function doctorCard(d: Doctor, lang: Lang) {
  const t = T[lang];
  const lines = [`${icon(d)} <b>${html(doctorText(d, "name", lang))}</b>`, `<i>${html(doctorText(d, "role", lang))}</i>`];
  const bio = doctorText(d, "bio", lang) || doctorText(d, "description", lang);
  if (bio) lines.push("", html(bio.length > 700 ? `${bio.slice(0, 700)}…` : bio));
  const facts: [string, string][] = [
    [t.exp, doctorText(d, "experience", lang)],
    [t.sched, doctorText(d, "schedule", lang)],
    [t.addr, doctorText(d, "address", lang)],
  ];
  const shown = facts.filter(([, v]) => v);
  if (shown.length) lines.push("", ...shown.map(([k, v]) => `<b>${k}:</b> ${html(v)}`));
  if (d.phone) lines.push("", `${t.phone}: ${html(d.phone)}`);
  return lines.join("\n");
}

function doctorButtons(d: Doctor, site: string, lang: Lang) {
  const t = T[lang];
  const rows: unknown[][] = [];
  if (d.telegram) rows.push([{ text: t.write, url: d.telegram }]);
  rows.push([{ text: t.bookThis, web_app: app(site, `/?doctor=${encodeURIComponent(d.id)}#qabul`) }]);
  rows.push([{ text: T[lang].back, callback_data: "doctors" }]);
  return { inline_keyboard: rows };
}

const send = (chatId: number, text: string, markup: unknown) =>
  tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup, link_preview_options: { is_disabled: true } });

// Salomlashuv animatsiyasi: public/bot/welcome.mp4. Bir marta yuborilgach Telegram file_id si saqlanadi (keyingi safar tezroq).
const WELCOME_VERSION = "v1";
const WELCOME_KEY = "tg-welcome-file";
const HEART_EFFECT = "5159385139981059251"; // ❤️ xabar effekti

type SentMessage = { animation?: { file_id: string } };

async function welcomeMedia(site: string): Promise<string> {
  const saved = await kvGet<{ v: string; id: string }>(WELCOME_KEY);
  return saved?.v === WELCOME_VERSION ? saved.id : new URL(`/bot/welcome.mp4?${WELCOME_VERSION}`, site).toString();
}

async function rememberWelcome(msg: SentMessage | null) {
  const id = msg?.animation?.file_id;
  if (id) await kvSet(WELCOME_KEY, { v: WELCOME_VERSION, id }).catch(() => undefined);
}

/** Animatsiya + matn + tugmalar. Effekt yoki animatsiya ishlamasa — soddaroq variantga tushadi. */
async function sendWelcome(chatId: number, site: string, caption: string, markup: unknown) {
  await tgApi("sendChatAction", { chat_id: chatId, action: "typing" });
  const animation = await welcomeMedia(site);
  const base = { chat_id: chatId, animation, caption, parse_mode: "HTML", reply_markup: markup };
  const sent =
    (await tgApi<SentMessage>("sendAnimation", { ...base, message_effect_id: HEART_EFFECT })) ??
    (await tgApi<SentMessage>("sendAnimation", base));
  if (sent) await rememberWelcome(sent);
  else await send(chatId, caption, markup);
}

/** Mavjud xabarni almashtiradi (rasm/animatsiya + matn + tugmalar). Bo'lmasa yangisini yuboradi. */
async function show(
  chatId: number,
  messageId: number,
  media: { type: "animation" | "photo"; media: string },
  caption: string,
  markup: unknown,
) {
  const edited = await tgApi<SentMessage>("editMessageMedia", {
    chat_id: chatId,
    message_id: messageId,
    media: { ...media, caption, parse_mode: "HTML" },
    reply_markup: markup,
  });
  if (edited) {
    if (media.type === "animation") await rememberWelcome(edited);
    return;
  }
  const method = media.type === "photo" ? "sendPhoto" : "sendAnimation";
  const sent = await tgApi<SentMessage>(method, {
    chat_id: chatId,
    [media.type]: media.media,
    caption,
    parse_mode: "HTML",
    reply_markup: markup,
  });
  if (!sent) await send(chatId, caption, markup);
  else if (media.type === "animation") await rememberWelcome(sent);
}

export async function POST(req: NextRequest) {
  if (!telegramConfigured()) return new Response("not configured", { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) {
    return new Response("forbidden", { status: 403 });
  }

  let update: Update = {};
  try {
    update = (await req.json()) as Update;
  } catch {}
  const site = siteUrlFrom(req);

  // Oddiy xabar (/start, /help yoki istalgan matn) — asosiy menyu
  const msg = update.message;
  if (msg && msg.chat.type === "private") {
    const lang = langOf(msg.from);
    const name = (msg.from?.first_name ?? "").replace(/[<>&]/g, "").slice(0, 40);
    await sendWelcome(msg.chat.id, site, T[lang].hello(name), mainMenu(site, lang));
  }

  // Tugma bosilganda
  const cb = update.callback_query;
  if (cb?.message) {
    const lang = langOf(cb.from);
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data ?? "";
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
    const anim = { type: "animation" as const, media: await welcomeMedia(site) };

    if (data === "home") {
      const name = (cb.from.first_name ?? "").replace(/[<>&]/g, "").slice(0, 40);
      await show(chatId, messageId, anim, T[lang].hello(name), mainMenu(site, lang));
    } else if (data === "doctors") {
      const { doctors } = await readData();
      await show(chatId, messageId, anim, `👨‍⚕️ <b>${T[lang].chooseDoctor}</b>`, doctorsMenu(doctors, lang));
    } else if (data.startsWith("doc:")) {
      const { doctors } = await readData();
      const d = doctors.find((x) => x.id === data.slice(4));
      if (d) {
        let caption = doctorCard(d, lang);
        if (caption.length > 1000) caption = `${caption.slice(0, 990)}…`;
        const markup = doctorButtons(d, site, lang);
        if (d.image) await show(chatId, messageId, { type: "photo", media: new URL(d.image, site).toString() }, caption, markup);
        else await show(chatId, messageId, anim, caption, markup);
      }
    }
  }

  // Telegram'ga har doim 200 qaytariladi, aks holda u xabarni qayta-qayta yuboradi
  return Response.json({ ok: true });
}
