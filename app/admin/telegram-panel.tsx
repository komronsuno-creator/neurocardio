"use client";

// Admin: Telegram bot holati va bir tugma bilan sozlash.
import { useCallback, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  reachable?: boolean;
  bot?: string | null;
  webhook?: string;
  webhookError?: string;
  site?: string;
  linkedDoctors?: string[];
};

type SetupResult = { ok?: boolean; site?: string; steps?: { name: string; ok: boolean }[]; error?: string };

export default function TelegramPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram", { cache: "no-store" });
      setStatus((await res.json()) as Status);
    } catch {
      setStatus({ configured: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setup() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/telegram", { method: "POST" });
      setResult((await res.json()) as SetupResult);
      await load();
    } catch {
      setResult({ error: "Serverga ulanib bo‘lmadi." });
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <div className="adm-card glass"><p className="adm-empty">Yuklanmoqda…</p></div>;

  const connected = Boolean(status.webhook) && status.webhook === `${status.site}/api/telegram/webhook`;

  return (
    <>
      <div className="adm-card glass">
        <h2>Telegram Mini App</h2>

        {!status.configured ? (
          <div className="adm-tg-steps">
            <p className="adm-hint">Bot tokeni hali qo‘shilmagan. Quyidagini bir marta qiling:</p>
            <ol>
              <li>
                Netlify → saytingiz → <b>Site configuration → Environment variables → Add a variable</b>
              </li>
              <li>
                Key: <code>TELEGRAM_BOT_TOKEN</code>, Value: BotFather bergan token
              </li>
              <li>
                <b>Deploys → Trigger deploy → Deploy site</b>, so‘ng shu sahifaga qayting
              </li>
            </ol>
          </div>
        ) : !status.reachable ? (
          <p className="adm-error">
            Token qo‘shilgan, lekin Telegram uni qabul qilmadi. Token to‘g‘ri nusxalanganini tekshiring (BotFather →
            /mybots → API Token).
          </p>
        ) : (
          <>
            <div className="adm-tg-grid">
              <div>
                <small>Bot</small>
                <a href={`https://t.me/${status.bot}`} target="_blank" rel="noopener noreferrer">
                  @{status.bot} ↗
                </a>
              </div>
              <div>
                <small>Holat</small>
                <strong className={connected ? "is-ok" : "is-warn"}>{connected ? "Ulangan" : "Sozlanmagan"}</strong>
              </div>
              <div>
                <small>Sayt manzili</small>
                <span>{status.site}</span>
              </div>
              <div>
                <small>Telegram’i bog‘langan shifokorlar</small>
                <span>{status.linkedDoctors?.length ? status.linkedDoctors.join(", ") : "Hali yo‘q"}</span>
              </div>
            </div>
            {status.webhookError ? <p className="adm-error">Telegram oxirgi xatosi: {status.webhookError}</p> : null}
          </>
        )}

        {status.configured && status.reachable ? (
          <div className="adm-row">
            <button className="btn btn-primary" type="button" onClick={setup} disabled={busy}>
              {busy ? "Sozlanmoqda…" : connected ? "Qayta sozlash" : "Botni saytga ulash"}
            </button>
          </div>
        ) : null}

        {result ? (
          <div className="adm-tg-result">
            {result.error ? <p className="adm-error">{result.error}</p> : null}
            {result.steps?.map((s) => (
              <p key={s.name} className={s.ok ? "is-ok" : "is-warn"}>
                {s.ok ? "✓" : "✗"} {s.name}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="adm-card glass">
        <h2>Keyingi qadamlar</h2>
        <ol className="adm-tg-list">
          <li>
            <b>Shifokorlarni bog‘lash:</b> har bir shifokor botga kiradi → pastdagi <b>NeyroCardio</b> tugmasi →
            sahifa oxiridagi “Shifokorlar uchun kirish” → login/parol → “Telegram’imni bog‘lash”. Shundan keyin yangi
            savollar va qabul so‘rovlari unga Telegram’da keladi.
          </li>
          <li>
            <b>To‘g‘ridan-to‘g‘ri havola (ixtiyoriy):</b> BotFather → /mybots → bot → <b>Bot Settings → Configure Mini App
            → Enable Mini App</b> → sayt manzilini yuboring. Shunda bot profilida “Open App” tugmasi chiqadi va
            <code>t.me/{status.bot ?? "bot"}?startapp</code> havolasi ishlaydi.
          </li>
          <li>
            <b>Bot rasmi:</b> BotFather → /mybots → bot → Edit Bot → Edit Botpic → NeyroCardio logosini yuboring.
          </li>
        </ol>
      </div>
    </>
  );
}
