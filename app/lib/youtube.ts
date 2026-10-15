// YouTube havolasidan video ID (va boshlanish vaqti) ni ajratib oladi.
// Qo'llab-quvvatlanadi: watch?v=, youtu.be/, /shorts/, /embed/, /live/, yalang'och 11 belgili ID.
export function parseYouTube(input: string): { id: string; start?: number } | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { id: raw };

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = u.pathname.split("/")[1] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      id = u.searchParams.get("v");
    } else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
  }

  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  // Boshlanish vaqti: t=90, t=90s, t=1m30s, start=90
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  if (t) {
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (m) {
      const seconds = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
      if (seconds > 0) return { id, start: seconds };
    }
  }

  return { id };
}
