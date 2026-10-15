import { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { mutate } from "../../../lib/store";
import { parseYouTube } from "../../../lib/youtube";
import type { Video } from "../../../lib/types";


// Sarlavha kiritilmasa YouTube'dan o'zi olinadi
async function fetchTitle(id: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${id}`,
    )}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: unknown };
    return typeof json.title === "string" && json.title.trim() ? json.title.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  let body: { url?: unknown; title?: unknown } = {};
  try {
    body = await req.json();
  } catch {}

  const parsed = parseYouTube(typeof body.url === "string" ? body.url : "");
  if (!parsed) {
    return Response.json({ error: "YouTube havolasi noto‘g‘ri." }, { status: 400 });
  }

  let title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  if (!title) title = (await fetchTitle(parsed.id)) ?? "Video";

  const video: Video = { id: parsed.id, title, ...(parsed.start ? { start: parsed.start } : {}) };

  const result = await mutate((data) => {
    if (data.videos.some((v) => v.id === video.id)) return "dup" as const;
    data.videos.unshift(video); // yangi video eng boshiga qo'shiladi
    return "ok" as const;
  });

  if (result === "dup") {
    return Response.json({ error: "Bu video allaqachon qo‘shilgan." }, { status: 409 });
  }
  return Response.json({ ok: true, video });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const removed = await mutate((data) => {
    const before = data.videos.length;
    data.videos = data.videos.filter((v) => v.id !== id);
    return before !== data.videos.length;
  });
  if (!removed) return Response.json({ error: "Video topilmadi." }, { status: 404 });
  return Response.json({ ok: true });
}
