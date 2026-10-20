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
import type { ChatDoctor, ChatMessage } from "../../lib/types";

const noStore = { "Cache-Control": "no-store" };
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

  return Response.json({ messages, ids: recent, doctors }, { headers: noStore });
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
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    if (name.length < 2) return Response.json({ error: "Ismingizni kiriting." }, { status: 400 });
    if (tooManyAttempts(`chat:${clientKey(req)}`, 6, 60 * 1000)) {
      return Response.json({ error: "Juda tez yozyapsiz. Bir daqiqadan keyin qayta urinib ko‘ring." }, { status: 429 });
    }
    msg = { id: newMessageId(), kind: "patient", name, text, ts: Date.now() };
  }

  // Javob berilayotgan xabar serverda tekshiriladi (iqtibosni soxtalashtirib bo'lmaydi)
  if (typeof body.replyTo === "string" && body.replyTo) {
    const original = await getMessage(body.replyTo);
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
  return Response.json({ ok: true, message: msg }, { headers: noStore });
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
