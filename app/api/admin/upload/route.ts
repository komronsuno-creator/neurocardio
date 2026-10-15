import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { UPLOAD_DIR } from "../../../lib/store";


const MAX = 5 * 1024 * 1024; // 5 MB

// Fayl turini kengaytmasiga emas, haqiqiy mazmuniga qarab aniqlaymiz
function detect(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get("file");
  } catch {}
  if (!file || typeof file === "string") {
    return Response.json({ error: "Rasm tanlanmagan." }, { status: 400 });
  }
  if (file.size > MAX) {
    return Response.json({ error: "Rasm 5 MB dan katta bo‘lmasligi kerak." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detect(buf);
  if (!ext) {
    return Response.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin." }, { status: 415 });
  }

  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return Response.json({ ok: true, url: `/api/uploads/${name}` });
}
