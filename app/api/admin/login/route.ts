import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE,
  SESSION_SECONDS,
  adminConfigured,
  checkPassword,
  isAdmin,
  makeToken,
} from "../../../lib/auth";
import { storageKind } from "../../../lib/store";


// Parolni ko'p marta taxmin qilishdan himoya: 10 daqiqada 8 ta urinish
const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW = 10 * 60 * 1000;
const LIMIT = 8;

function clientKey(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

// Holatni tekshirish: kirganmi? parol sozlanganmi?
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { configured: adminConfigured(), authed: isAdmin(req), storage: storageKind() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json(
      {
        error:
          "ADMIN_PASSWORD o‘rnatilmagan. Kompyuterda: .env.local fayliga qo‘shing. Netlify'da: Site configuration → Environment variables bo‘limiga qo‘shib, saytni qayta deploy qiling.",
      },
      { status: 503 },
    );
  }

  const key = clientKey(req);
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.reset > now && rec.count >= LIMIT) {
    return NextResponse.json({ error: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring." }, { status: 429 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {}

  if (!checkPassword(password)) {
    attempts.set(key, {
      count: rec && rec.reset > now ? rec.count + 1 : 1,
      reset: rec && rec.reset > now ? rec.reset : now + WINDOW,
    });
    return NextResponse.json({ error: "Parol noto‘g‘ri." }, { status: 401 });
  }

  attempts.delete(key);
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: makeToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return res;
}

// Chiqish
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
