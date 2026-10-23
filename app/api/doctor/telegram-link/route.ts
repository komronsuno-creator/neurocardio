// Shifokor kabineti: Telegram'ni bot orqali bog'lash uchun bir martalik havola (15 daqiqa amal qiladi).
import { NextRequest } from "next/server";
import { createLinkCode } from "../../../lib/bot";
import { doctorIdFrom } from "../../../lib/doctor-auth";
import { botUsername } from "../../../lib/telegram";

export async function POST(req: NextRequest) {
  const doctorId = doctorIdFrom(req);
  if (!doctorId) return Response.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const bot = await botUsername();
  if (!bot) return Response.json({ error: "Telegram bot hali sozlanmagan." }, { status: 503 });
  const code = await createLinkCode(doctorId);
  return Response.json({ url: `https://t.me/${bot}?start=link_${code}` }, { headers: { "Cache-Control": "no-store" } });
}
