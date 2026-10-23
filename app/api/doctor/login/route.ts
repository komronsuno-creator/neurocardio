import { NextRequest, NextResponse } from "next/server";
import {
  DOCTOR_COOKIE,
  DOCTOR_SESSION_SECONDS,
  checkLogin,
  clearAttempts,
  doctorIdFrom,
  makeDoctorToken,
  tooManyAttempts,
} from "../../../lib/doctor-auth";
import { adminConfigured } from "../../../lib/auth";
import { readData } from "../../../lib/store";
import { botUsername, getDoctorLinks, telegramConfigured } from "../../../lib/telegram";

const clientKey = (req: NextRequest) =>
  (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

// Kim kirgan: shifokorning to'liq profili (faqat o'zi uchun) yoki null
export async function GET(req: NextRequest) {
  const id = doctorIdFrom(req);
  if (!id) return NextResponse.json({ doctor: null }, { headers: { "Cache-Control": "no-store" } });
  const [{ doctors }, links, bot] = await Promise.all([readData(), getDoctorLinks(), botUsername()]);
  const doctor = doctors.find((d) => d.id === id) ?? null;
  return NextResponse.json(
    { doctor, telegramLinked: Boolean(links[id]), telegramReady: telegramConfigured(), telegramBot: bot },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Sayt hali sozlanmagan (ADMIN_PASSWORD yo‘q)." }, { status: 503 });
  }
  const key = `doctor-login:${clientKey(req)}`;
  if (tooManyAttempts(key)) {
    return NextResponse.json({ error: "Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring." }, { status: 429 });
  }

  let login = "";
  let password = "";
  try {
    const body = (await req.json()) as { login?: unknown; password?: unknown };
    login = typeof body.login === "string" ? body.login : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {}

  const id = await checkLogin(login, password);
  const { doctors } = await readData();
  if (!id || !doctors.some((d) => d.id === id)) {
    return NextResponse.json({ error: "Login yoki parol noto‘g‘ri." }, { status: 401 });
  }

  clearAttempts(key);
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: DOCTOR_COOKIE,
    value: makeDoctorToken(id),
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: DOCTOR_SESSION_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: DOCTOR_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
