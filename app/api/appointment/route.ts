// Qabulga yozilish: shifokorning Telegram'i bog'langan bo'lsa, so'rov bot orqali to'g'ridan-to'g'ri unga boradi.
// Bog'lanmagan bo'lsa — mijoz avvalgidek shifokorning Telegram sahifasini ochadi.
import { NextRequest } from "next/server";
import { tooManyAttempts } from "../../lib/doctor-auth";
import { readData } from "../../lib/store";
import { getDoctorLinks, html, sendMessage, tgFullName, verifyInitData } from "../../lib/telegram";

const clientKey = (req: NextRequest) =>
  (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {}

  const doctorId = typeof body.doctorId === "string" ? body.doctorId : "";
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/[^\d+]/g, "").slice(0, 16) : "";

  const { doctors } = await readData();
  const doctor = doctors.find((d) => d.id === doctorId);
  if (!doctor) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });
  if (name.length < 2 || !/^\+?\d{9,15}$/.test(phone)) {
    return Response.json({ error: "Ism va telefon raqamini to‘g‘ri kiriting." }, { status: 400 });
  }
  if (tooManyAttempts(`appt:${clientKey(req)}`, 5, 10 * 60 * 1000)) {
    return Response.json({ error: "Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring." }, { status: 429 });
  }

  const chatId = (await getDoctorLinks())[doctor.id];
  if (!chatId) return Response.json({ sent: false, telegram: doctor.telegram });

  const tg = verifyInitData(body.initData);
  const lines = ["🩺 <b>Yangi qabul so‘rovi</b> (NeyroCardio)", "", `👤 ${html(name)}`, `📞 ${html(phone)}`];
  if (tg) lines.push(`✈️ Telegram: ${tg.username ? `@${html(tg.username)}` : html(tgFullName(tg))}`);
  lines.push("", "Bemor bilan bog‘lanib, qabul vaqtini kelishib oling.");
  const markup = tg?.username ? { inline_keyboard: [[{ text: "Bemorga yozish", url: `https://t.me/${tg.username}` }]] } : undefined;

  const sent = await sendMessage(chatId, lines.join("\n"), markup);
  return Response.json(sent ? { sent: true } : { sent: false, telegram: doctor.telegram });
}
