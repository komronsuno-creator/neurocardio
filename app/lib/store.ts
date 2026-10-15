// Sayt ma'lumotlari (shifokorlar va videolar) oddiy JSON faylda saqlanadi.
// Fayl: <loyiha>/data/site.json  (DATA_DIR muhit o'zgaruvchisi bilan o'zgartirish mumkin)
// Yuklangan rasmlar: <DATA_DIR>/uploads/
import { promises as fs } from "fs";
import path from "path";
import type { Doctor, SiteData } from "./types";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const FILE = path.join(DATA_DIR, "site.json");

// Sayt hozirgi ko'rinishidagi boshlang'ich ma'lumotlar
const DEFAULTS: SiteData = {
  doctors: [
    {
      id: "d1",
      name: "Sobitjon Qurbonov",
      role: "Nevrolog",
      description: "Nevrologiya mutaxassisi",
      image: "/doctor-1.png",
      phone: "+998909105501",
      telegram: "https://t.me/sobitjon_090",
      accent: "neyro",
    },
    {
      id: "d2",
      name: "Saidburxon Turgunboyev",
      role: "Kardiolog",
      description: "Kardiologiya mutaxassisi",
      image: "/doctor-2.png",
      phone: "+998976305959",
      telegram: "https://t.me/Drsaidburxon",
      accent: "cardio",
    },
  ],
  videos: [
    { id: "Ok1ZAK3LvRA", title: "Parkinson kasalligi — sabablari" },
    { id: "LW7kcd6s_OI", title: "Yurak nega og‘riydi?", start: 55 },
    { id: "ZUxBWlhH37g", title: "Bosh aylanishi — sabablari" },
    { id: "dhQWfXjt_9Y", title: "QON BOSIMINI O‘LCHASHDA YO‘L QO‘YILADIGAN XATOLAR" },
    { id: "GLH4FCgnCGc", title: "Yurak og‘rig‘i qachon xavfli? Stenokardiya va infarkt xavfi" },
    { id: "5whqYjafpVI", title: "Uyqu-Miya va Tana Uchun Nega Muhim?", start: 30 },
  ],
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function writeRaw(data: SiteData) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FILE); // atomik yozish: fayl yarim yozilib qolmaydi
}

export async function readData(): Promise<SiteData> {
  try {
    const text = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(text) as Partial<SiteData>;
    return {
      doctors: Array.isArray(parsed.doctors) ? (parsed.doctors as Doctor[]) : [],
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = clone(DEFAULTS);
      try {
        await writeRaw(fresh);
      } catch {
        // Yozib bo'lmasa ham sayt boshlang'ich ma'lumot bilan ishlayveradi
      }
      return fresh;
    }
    console.error("site.json o'qilmadi:", err);
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
