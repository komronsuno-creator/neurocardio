import { promises as fs } from "fs";
import path from "path";
import { UPLOAD_DIR } from "../../../lib/store";

// Yuklangan rasmlar shu manzildan beriladi (public/ ga runtime'da qo'shilgan fayllar
// production'da ko'rinmaydi, shuning uchun alohida route ishlatiladi).
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const m = name.match(/^[a-f0-9]{16}\.(jpg|png|webp)$/);
  if (!m) return new Response("Not found", { status: 404 });

  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[m[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
