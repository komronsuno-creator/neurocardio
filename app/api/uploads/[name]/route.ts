import { readUpload, UPLOAD_NAME } from "../../../lib/store";

// Yuklangan rasmlar shu manzildan beriladi (Netlify'da Blobs'dan, kompyuterda data/uploads/ dan).
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const m = name.match(UPLOAD_NAME);
  if (!m) return new Response("Not found", { status: 404 });

  const buf = await readUpload(name);
  if (!buf) return new Response("Not found", { status: 404 });

  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": TYPES[m[1]],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
