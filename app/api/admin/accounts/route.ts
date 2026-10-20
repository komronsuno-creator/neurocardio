import { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { listLogins, setAccount } from "../../../lib/doctor-auth";
import { readData, storageError } from "../../../lib/store";

// Shifokorlarning chat/profil uchun loginlari (parollar ko'rsatilmaydi)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json({ logins: await listLogins() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {}
  const id = typeof body.id === "string" ? body.id : "";
  const login = typeof body.login === "string" ? body.login : "";
  const password = typeof body.password === "string" ? body.password : "";

  const { doctors } = await readData();
  if (!doctors.some((d) => d.id === id)) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });

  try {
    const err = await setAccount(id, login, password);
    if (err) return Response.json({ error: err }, { status: 400 });
  } catch (err) {
    return Response.json({ error: storageError(err) }, { status: 500 });
  }
  return Response.json({ ok: true });
}
