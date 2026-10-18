// Sayt ma'lumotlari (shifokorlar va videolar) va yuklangan rasmlar shu yerda saqlanadi.
//
// Ikki xil saqlash joyi bor, kerakligi avtomatik tanlanadi:
//  1) Netlify'da: Netlify Blobs (Netlify serverida diskka yozib bo'lmaydi, shuning uchun
//     admin paneldagi o'zgarishlar Blobs ombori "neurocardio" ga yoziladi).
//  2) Kompyuterda (localhost) yoki VPS'da: oddiy fayllar — <loyiha>/data/site.json va data/uploads/
//     (DATA_DIR muhit o'zgaruvchisi bilan papkani o'zgartirish mumkin).
//
// Netlify Blobs birinchi marta bo'sh bo'ladi: unda data/site.json dagi ma'lumotlar boshlang'ich
// sifatida olinadi va keyingi o'zgarishlar Blobs'ga yoziladi.
import { promises as fs } from "fs";
import path from "path";
import { getStore } from "@netlify/blobs";
import seed from "../../data/site.json";
import type { Doctor, SiteData, Video } from "./types";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const FILE = path.join(DATA_DIR, "site.json");
const DATA_KEY = "site.json";

type BlobStore = ReturnType<typeof getStore>;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function normalize(parsed: Partial<SiteData> | null | undefined): SiteData {
  return {
    doctors: Array.isArray(parsed?.doctors) ? (parsed!.doctors as Doctor[]) : [],
    videos: Array.isArray(parsed?.videos) ? (parsed!.videos as Video[]) : [],
  };
}

const DEFAULTS: SiteData = normalize(seed as Partial<SiteData>);

// Netlify Blobs faqat Netlify muhitida mavjud. Kompyuterda getStore xato beradi — unda fayllar ishlatiladi.
// Har so'rovda qayta olinadi: Netlify kirish kalitini so'rov paytida beradi.
function blobs(): BlobStore | null {
  if (process.env.STORAGE === "fs") return null;
  try {
    return getStore({ name: "neurocardio", consistency: "strong" });
  } catch {
    return null;
  }
}

/** Qaysi ombor ishlayotganini ko'rsatadi (admin panelda diagnostika uchun). */
export function storageKind(): "netlify-blobs" | "files" {
  return blobs() ? "netlify-blobs" : "files";
}

/** Saqlashdagi xatoni foydalanuvchiga tushunarli matnga aylantiradi. */
export function storageError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
    return "Server diskiga yozib bo‘lmadi. Hosting fayl yozishga ruxsat bermayapti.";
  }
  return "Ma’lumotni saqlab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.";
}

/* ---------------- Sayt ma'lumotlari ---------------- */

async function writeRaw(data: SiteData) {
  const store = blobs();
  if (store) {
    await store.setJSON(DATA_KEY, data);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FILE); // atomik yozish: fayl yarim yozilib qolmaydi
}

export async function readData(): Promise<SiteData> {
  const store = blobs();
  if (store) {
    try {
      const saved = (await store.get(DATA_KEY, { type: "json" })) as Partial<SiteData> | null;
      if (saved) return normalize(saved);
    } catch (err) {
      console.error("Netlify Blobs'dan o'qib bo'lmadi:", err);
    }
    return clone(DEFAULTS);
  }

  try {
    const text = await fs.readFile(FILE, "utf8");
    return normalize(JSON.parse(text) as Partial<SiteData>);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error("site.json o'qilmadi:", err);
    return clone(DEFAULTS);
  }
}

// O'zgartirishlar ketma-ket bajariladi (bir vaqtda ikki so'rov bir-birini bosib ketmasin)
let chain: Promise<unknown> = Promise.resolve();

export function mutate<T>(fn: (data: SiteData) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const data = await readData();
    const result = await fn(data);
    await writeRaw(data);
    return result;
  });
  chain = run.catch(() => undefined);
  return run;
}

/* ---------------- Yuklangan rasmlar ---------------- */

export const UPLOAD_NAME = /^[a-f0-9]{16}\.(jpg|png|webp)$/;

export async function saveUpload(name: string, buf: Buffer, type: string): Promise<void> {
  const store = blobs();
  if (store) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    await store.set(`uploads/${name}`, ab, { metadata: { type } });
    return;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
}

export async function readUpload(name: string): Promise<Uint8Array | null> {
  if (!UPLOAD_NAME.test(name)) return null;
  const store = blobs();
  if (store) {
    try {
      const ab = await store.get(`uploads/${name}`, { type: "arrayBuffer" });
      return ab ? new Uint8Array(ab) : null;
    } catch {
      return null;
    }
  }
  try {
    return new Uint8Array(await fs.readFile(path.join(UPLOAD_DIR, name)));
  } catch {
    return null;
  }
}

export async function removeUpload(image: string): Promise<void> {
  const m = image.match(/^\/api\/uploads\/([a-f0-9]{16}\.(?:jpg|png|webp))$/);
  if (!m) return;
  try {
    const store = blobs();
    if (store) await store.delete(`uploads/${m[1]}`);
    else await fs.unlink(path.join(UPLOAD_DIR, m[1]));
  } catch {}
}
