// Shifokor va Telegram: avtomatik kirish va akkauntni bog'lash.
import { NextRequest, NextResponse } from "next/server";
import { DOCTOR_COOKIE, DOCTOR_SESSION_SECONDS, doctorIdFrom, makeDoctorToken } from "../../../lib/doctor-auth";
import { readData, storageError } from "../../../lib/store";
import { doctorIdByTelegram, linkDoctor, verifyInitData } from "../../../lib/telegram";

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Mini App ochilganda: Telegram akkaunti shifokorga bog'langan bo'lsa — parolsiz kiradi
export async function POST(req: NextRequest) {
  const user = verifyInitData((await body(req)).initData);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const id = await doctorIdByTelegram(user.id);
  const { doctors } = await readData();
  if (!id || !doctors.some((d) => d.id === id)) return NextResponse.json({ ok: false }, { status: 404 });

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

// Kabinetda "Telegram'ni bog'lash": shifokor tizimga kirgan bo'lishi va sahifa Telegram ichida ochilgan bo'lishi kerak
export async function PUT(req: NextRequest) {
  const doctorId = doctorIdFrom(req);
  if (!doctorId) return Response.json({ error: "Avval tizimga kiring." }, { status: 401 });
  const user = verifyInitData((await body(req)).initData);
  if (!user) {
    return Response.json(
      { error: "Telegram ma’lumoti tasdiqlanmadi. Kabinetni @neyrocardio_bot orqali Telegram ichida oching." },
      { status: 400 },
    );
  }
  try {
    await linkDoctor(doctorId, user.id);
  } catch (err) {
    return Response.json({ error: storageError(err) }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// Bog'lanishni uzish
export async function DELETE(req: NextRequest) {
  const doctorId = doctorIdFrom(req);
  if (!doctorId) return Response.json({ error: "Avval tizimga kiring." }, { status: 401 });
  await linkDoctor(doctorId, null);
  return Response.json({ ok: true });
}
