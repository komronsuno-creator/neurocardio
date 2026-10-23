import { NextRequest } from "next/server";
import { isAdmin } from "../../lib/auth";
import {
  PAGE,
  deleteMessage,
  getMessage,
  getMessages,
  isMessageId,
  messageIds,
  newMessageId,
  prune,
  saveMessage,
} from "../../lib/chat";
import { doctorIdFrom, tooManyAttempts } from "../../lib/doctor-auth";
import { readData, storageError } from "../../lib/store";
import { getDoctorLinks, html, openButton, sendMessage, siteUrlFrom, tgFullName, verifyInitData } from "../../lib/telegram";
import type { ChatDoctor, ChatMessage } from "../../lib/types";

const noStore = { "Cache-Control": "no-store" };

// Saytga chiqadigan ko'rinish: Telegram ID kabi shaxsiy maydonlarsiz
const toPublic = ({ tgUser: _tg, tgLang: _l, ...m }: ChatMessage): ChatMessage => (void _tg, void _l, m);
const clientKey = (req: NextRequest) =>
  (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

// Chatdagi shifokorlar (ism, rasm, rang) — xabarlar yonida ko'rsatish uchun
async function chatDoctors(): Promise<ChatDoctor[]> {
  const { doctors } = await readData();
  return doctors.map(({ id, name, role, image, accent, ru }) => ({ id, name, role, image, accent, ru }));
}

// Xabarlar ro'yxati.
// ?after=<id> — shu xabardan keyingilar (har necha soniyada yangilash uchun).
// Javobda "ids" — oxirgi xabarlar ID lari: o'chirilgan xabarni mijoz shundan biladi.
export async function GET(req: NextRequest) {
  const after = req.nextUrl.searchParams.get("after") ?? "";
  const all = await messageIds();
  const recent = all.slice(-150);

  let pick: string[];
  if (after && isMessageId(after)) {
    pick = all.filter((id) => id > after).slice(-PAGE);
  } else {
    pick = all.slice(-PAGE);
  }

  const [messages, doctors] = await Promise.all([
    getMessages(pick),
    after ? Promise.resolve(undefined) : chatDoctors(),
  ]);

  return Response.json({ messages: messages.map(toPublic), ids: recent, doctors }, { headers: noStore });
}

// Yangi xabar. Shifokor tizimga kirgan bo'lsa — shifokor nomidan, aks holda bemor ismi bilan.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {}

  // Botlar uchun yashirin maydon: to'ldirilgan bo'lsa, xabar jim saqlanmaydi
  if (typeof body.website === "string" && body.website) {
    return Response.json({ ok: true }, { headers: noStore });
  }

  const text = typeof body.text === "string" ? body.text.replace(/\r\n/g, "\n").trim().slice(0, 1000) : "";
  if (!text) return Response.json({ error: "Xabar bo‘sh." }, { status: 400 });

  const doctorId = doctorIdFrom(req);
  let msg: ChatMessage;

  if (doctorId) {
    const { doctors } = await readData();
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor) return Response.json({ error: "Shifokor profili topilmadi." }, { status: 403 });
    msg = { id: newMessageId(), kind: "doctor", doctorId, name: doctor.name, text, ts: Date.now() };
  } else {
    // Telegram Mini App ichidan yozilgan bo'lsa — ism Telegram'dan, imzo bilan tasdiqlangan
    const tg = verifyInitData(body.initData);
    const typed = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    const name = typed || (tg ? tgFullName(tg) : "");
    if (name.length < 2) return Response.json({ error: "Ismingizni kiriting." }, { status: 400 });
    if (tooManyAttempts(`chat:${clientKey(req)}`, 6, 60 * 1000)) {
      return Response.json({ error: "Juda tez yozyapsiz. Bir daqiqadan keyin qayta urinib ko‘ring." }, { status: 429 });
    }
    msg = { id: newMessageId(), kind: "patient", name, text, ts: Date.now(), ...(tg ? { tgUser: tg.id, tgLang: (tg.language_code ?? "").startsWith("ru") ? ("ru" as const) : ("uz" as const) } : {}) };
  }

  // Javob berilayotgan xabar serverda tekshiriladi (iqtibosni soxtalashtirib bo'lmaydi)
  let original: ChatMessage | null = null;
  if (typeof body.replyTo === "string" && body.replyTo) {
    original = await getMessage(body.replyTo);
    if (original) {
      msg.replyTo = { id: original.id, name: original.name, text: original.text.slice(0, 140) };
    }
  }

  try {
    await saveMessage(msg);
    prune(await messageIds()).catch(() => undefined);
  } catch (err) {
    console.error("Chat xabari saqlanmadi:", err);
    return Response.json({ error: storageError(err) }, { status: 500 });
  }

  await notify(req, msg, original);
  return Response.json({ ok: true, message: toPublic(msg) }, { headers: noStore });
}

// Telegram xabarnomalari: yangi savol — shifokorlarga, shifokor javobi — bemorga.
// Bot sozlanmagan bo'lsa jim o'tib ketadi.
async function notify(req: NextRequest, msg: ChatMessage, original: ChatMessage | null) {
  const site = siteUrlFrom(req);
  if (!site.startsWith("https://")) return; // Telegram tugmalari faqat https bilan ishlaydi
  const button = (text: string) => openButton(site, text, "/#savollar");
  const short = (t: string) => html(t.length > 600 ? `${t.slice(0, 600)}…` : t);
  const jobs: Promise<unknown>[] = [];

  if (msg.kind === "patient") {
    const links = await getDoctorLinks();
    const text = `💬 <b>Yangi savol</b> — ${html(msg.name)}\n\n${short(msg.text)}`;
    for (const chatId of Object.values(links)) jobs.push(sendMessage(chatId, text, button("Chatni ochish")));
  } else if (original?.tgUser) {
    const ru = original.tgLang === "ru";
    const text = ru
      ? `👨‍⚕️ <b>${html(msg.name)}</b> ответил(а) на ваш вопрос:\n\n${short(msg.text)}`
      : `👨‍⚕️ <b>${html(msg.name)}</b> savolingizga javob berdi:\n\n${short(msg.text)}`;
    jobs.push(sendMessage(original.tgUser, text, button(ru ? "Посмотреть ответ" : "Javobni ko‘rish")));
  }
  await Promise.allSettled(jobs);
}

// Xabarni o'chirish: faqat shifokorlar va admin
export async function DELETE(req: NextRequest) {
  if (!doctorIdFrom(req) && !isAdmin(req)) {
    return Response.json({ error: "Xabarni faqat shifokor o‘chira oladi." }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const removed = await deleteMessage(id);
  if (!removed) return Response.json({ error: "Xabar topilmadi." }, { status: 404 });
  return Response.json({ ok: true }, { headers: noStore });
}
