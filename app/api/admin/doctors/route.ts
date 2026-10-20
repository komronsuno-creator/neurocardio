import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { mutate, removeUpload, storageError } from "../../../lib/store";
import type { Doctor } from "../../../lib/types";
import { parseDoctor as parse, str } from "../../../lib/doctor-form";
import { deleteAccount } from "../../../lib/doctor-auth";


const saveFailed = (err: unknown) => {
  console.error("Shifokor ma'lumoti saqlanmadi:", err);
  return Response.json({ error: storageError(err) }, { status: 500 });
};

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

  let doctor: Doctor;
  try {
    doctor = await mutate((data) => {
      const d: Doctor = {
        id: randomBytes(6).toString("hex"),
        accent: data.doctors.length % 2 === 0 ? "neyro" : "cardio",
        ...parsed.fields,
      };
      data.doctors.push(d);
      return d;
    });
  } catch (err) {
    return saveFailed(err);
  }
  return Response.json({ ok: true, doctor });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await readBody(req);
  const parsed = parse(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const id = str(body.id, 40);
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
    return saveFailed(err);
  }
  if (!doctor) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });
  if (oldImage && oldImage !== doctor.image) await removeUpload(oldImage);
  return Response.json({ ok: true, doctor });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let image = "";
  let removed: boolean;
  try {
    removed = await mutate((data) => {
      const found = data.doctors.find((d) => d.id === id);
      if (!found) return false;
      image = found.image;
      data.doctors = data.doctors.filter((d) => d.id !== id);
      return true;
    });
  } catch (err) {
    return saveFailed(err);
  }
  if (!removed) return Response.json({ error: "Shifokor topilmadi." }, { status: 404 });
  await removeUpload(image);
  await deleteAccount(id);
  return Response.json({ ok: true });
}
