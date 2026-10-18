import { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "../../../lib/auth";
import { mutate, storageError } from "../../../lib/store";
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

const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 160) : "");

const saveFailed = (err: unknown) => {
  console.error("Video saqlanmadi:", err);
  return Response.json({ error: storageError(err) }, { status: 500 });
};

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Yangi video qo'shish
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await readBody(req);

  const parsed = parseYouTube(typeof body.url === "string" ? body.url : "");
  if (!parsed) {
    return Response.json({ error: "YouTube havolasi noto‘g‘ri." }, { status: 400 });
  }

  let title = text(body.title);
  if (!title) title = (await fetchTitle(parsed.id)) ?? "Video";
  const titleRu = text(body.titleRu);

  const video: Video = {
    id: parsed.id,
    title,
    ...(titleRu ? { titleRu } : {}),
    ...(parsed.start ? { start: parsed.start } : {}),
  };

  let result: "dup" | "ok";
  try {
    result = await mutate((data) => {
      if (data.videos.some((v) => v.id === video.id)) return "dup" as const;
      data.videos.unshift(video); // yangi video eng boshiga qo'shiladi
      return "ok" as const;
    });
  } catch (err) {
    return saveFailed(err);
  }

  if (result === "dup") {
    return Response.json({ error: "Bu video allaqachon qo‘shilgan." }, { status: 409 });
  }
  return Response.json({ ok: true, video });
}

// Sarlavhalarni (o'zbekcha va ruscha) tahrirlash
export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await readBody(req);
  const id = typeof body.id === "string" ? body.id : "";
  const title = text(body.title);
  const titleRu = text(body.titleRu);
  if (!title) return Response.json({ error: "O‘zbekcha sarlavha bo‘sh bo‘lmasligi kerak." }, { status: 400 });

  let video: Video | null;
  try {
    video = await mutate((data) => {
      const found = data.videos.find((v) => v.id === id);
      if (!found) return null;
      found.title = title;
      if (titleRu) found.titleRu = titleRu;
      else delete found.titleRu;
      return found;
    });
  } catch (err) {
    return saveFailed(err);
  }
  if (!video) return Response.json({ error: "Video topilmadi." }, { status: 404 });
  return Response.json({ ok: true, video });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let removed: boolean;
  try {
    removed = await mutate((data) => {
      const before = data.videos.length;
      data.videos = data.videos.filter((v) => v.id !== id);
      return before !== data.videos.length;
    });
  } catch (err) {
    return saveFailed(err);
  }
  if (!removed) return Response.json({ error: "Video topilmadi." }, { status: 404 });
  return Response.json({ ok: true });
}
