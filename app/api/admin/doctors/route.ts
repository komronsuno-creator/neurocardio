import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { UPLOAD_DIR, mutate } from "../../../lib/store";
import type { Doctor } from "../../../lib/types";


const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normTelegram(value: string): string | null {
  let s = value.trim();
  if (!s) return null;
  if (s.startsWith("@")) s = s.slice(1);
  if (/^[A-Za-z0-9_]{4,32}$/.test(s)) return `https://t.me/${s}`;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (["t.me", "www.t.me", "telegram.me"].includes(u.hostname.toLowerCase())) {
      return `https://t.me${u.pathname}${u.search}`;
    }
  } catch {}
  return null;
}

function normPhone(value: string): string | null {
  const s = value.replace(/[\s()-]/g, "");
  if (!/^\+?\d{9,15}$/.test(s)) return null;
  return s;
}

function normImage(value: string): string | null {
  if (!value) return "";
  if (/^\/(?!\/)[A-Za-z0-9._\-/]+$/.test(value)) return value; // /doctor-3.png yoki /api/uploads/...
  if (/^https:\/\/\S+$/.test(value)) return value;
  return null;
}

type Parsed = { ok: true; fields: Omit<Doctor, "id" | "accent"> } | { ok: false; error: string };

function parse(body: Record<string, unknown>): Parsed {
  const name = str(body.name, 80);
  const role = str(body.role, 60);
  if (!name) return { ok: false, error: "Ism familiya kiritilishi shart." };
  if (!role) return { ok: false, error: "Mutaxassislik kiritilishi shart." };

  const phone = normPhone(str(body.phone, 40));
  if (!phone) return { ok: false, error: "Telefon raqami noto‘g‘ri (masalan +998901234567)." };

  const telegram = normTelegram(str(body.telegram, 200));
  if (!telegram) return { ok: false, error: "Telegram manzili noto‘g‘ri (masalan @username yoki https://t.me/username)." };

  const image = normImage(str(body.image, 300));
  if (image === null) return { ok: false, error: "Rasm manzili noto‘g‘ri." };

  return {
    ok: true,
    fields: {
      name,
      role,
      description: str(body.description, 160) || `${role} mutaxassisi`,
      image,
      phone,
      telegram,
      bio: str(body.bio, 3000),
      experience: str(body.experience, 120),
      education: str(body.education, 400),
      schedule: str(body.schedule, 200),
      address: str(body.address, 200),
    },
  };
}

async function removeUpload(image: string) {
  const m = image.match(/^\/api\/uploads\/([a-f0-9]{16}\.(?:jpg|png|webp))$/);
  if (!m) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, m[1]));
  } catch {}
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const parsed = parse(await readBody(req));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const doctor = await mutate((data) => {
    const d: Doctor = {
      id: randomBytes(6).toString("hex"),
      accent: data.doctors.length % 2 === 0 ? "neyro" : "cardio",
      ...parsed.fields,
    };
    data.doctors.push(d);
    return d;
  });
  return Response.json({ ok: true, doctor });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await readBody(req);
  const parsed = parse(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const id = str(body.id, 40);
  let oldImage = "";
  const doctor = await mutate((data) => {
    const i = data.doctors.findIndex((d) => d.id === id);
    if (i === -1) return null;
    oldImage = data.doctors[i].image;
    data.doctors[i] = { ...data.doctors[i], ...parsed.fields };
    return data.doctors[i];
  });
  if (!doctor) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });
  if (oldImage && oldImage !== doctor.image) await removeUpload(oldImage);
  return Response.json({ ok: true, doctor });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let image = "";
  const removed = await mutate((data) => {
    const found = data.doctors.find((d) => d.id === id);
    if (!found) return false;
    image = found.image;
    data.doctors = data.doctors.filter((d) => d.id !== id);
    return true;
  });
  if (!removed) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });
  await removeUpload(image);
  return Response.json({ ok: true });
}
