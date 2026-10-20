import { NextRequest } from "next/server";
import { doctorIdFrom, setAccount, listLogins } from "../../../lib/doctor-auth";
import { parseDoctor } from "../../../lib/doctor-form";
import { mutate, removeUpload, storageError } from "../../../lib/store";
import type { Doctor } from "../../../lib/types";

// Shifokor faqat o'z profilini o'zgartiradi (rangi va tartibi admin ixtiyorida qoladi)
export async function PUT(req: NextRequest) {
  const id = doctorIdFrom(req);
  if (!id) return Response.json({ error: "Avval tizimga kiring." }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {}

  const parsed = parseDoctor(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // Parolni almashtirish (ixtiyoriy)
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword) {
    const login = (await listLogins())[id] ?? "";
    const err = await setAccount(id, login, newPassword);
    if (err) return Response.json({ error: err }, { status: 400 });
  }

  let oldImage = "";
  let doctor: Doctor | null;
  try {
    doctor = await mutate((data) => {
      const i = data.doctors.findIndex((d) => d.id === id);
      if (i === -1) return null;
      oldImage = data.doctors[i].image;
      const next: Doctor = { ...data.doctors[i], ...parsed.fields };
      if (!parsed.fields.ru) delete next.ru;
      data.doctors[i] = next;
      return next;
    });
  } catch (err) {
    console.error("Profil saqlanmadi:", err);
    return Response.json({ error: storageError(err) }, { status: 500 });
  }
  if (!doctor) return Response.json({ error: "Profil topilmadi." }, { status: 404 });
  if (oldImage && oldImage !== doctor.image) await removeUpload(oldImage);
  return Response.json({ ok: true, doctor });
}
