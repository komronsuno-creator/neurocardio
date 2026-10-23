"use client";

// Shifokor kabineti: o'z login/paroli bilan kiradi, profilini (UZ/RU, rasm) va parolini o'zgartiradi.
// Chatda shu sessiya bilan shifokor sifatida yozadi va keraksiz xabarlarni o'chiradi.
import { useEffect, useRef, useState } from "react";
import "../extra.css";
import "../premium.css";
import "../chat.css";
import type { Doctor, DoctorRu } from "../lib/types";
import { getWebApp, tgInitData, whenTelegram } from "../lib/tg-client";

type Status = "loading" | "login" | "ready";

const FIELDS = {
  name: "",
  role: "",
  description: "",
  phone: "",
  telegram: "",
  instagram: "",
  image: "",
  bio: "",
  experience: "",
  education: "",
  schedule: "",
  address: "",
};

const RU_FIELDS: Required<DoctorRu> = {
  name: "",
  role: "",
  description: "",
  bio: "",
  experience: "",
  education: "",
  schedule: "",
  address: "",
};

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.error || "Xatolik yuz berdi.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export default function DoctorPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ ...FIELDS });
  const [ru, setRu] = useState({ ...RU_FIELDS });
  const [newPassword, setNewPassword] = useState("");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [tgInfo, setTgInfo] = useState({ linked: false, ready: false, bot: "" as string | null });
  const [inTg, setInTg] = useState(false);
  const toastTimer = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function notify(text: string, error = false) {
    setToast({ text, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }

  function fill(d: Doctor) {
    setDoctor(d);
    setForm({
      name: d.name,
      role: d.role,
      description: d.description,
      phone: d.phone,
      telegram: d.telegram,
      instagram: d.instagram ? "@" + d.instagram.replace(/^https:\/\/instagram\.com\//, "") : "",
      image: d.image,
      bio: d.bio ?? "",
      experience: d.experience ?? "",
      education: d.education ?? "",
      schedule: d.schedule ?? "",
      address: d.address ?? "",
    });
    setRu({ ...RU_FIELDS, ...(d.ru ?? {}) });
  }

  async function loadMe() {
    try {
      const data = await api<{
        doctor: Doctor | null;
        telegramLinked?: boolean;
        telegramReady?: boolean;
        telegramBot?: string | null;
      }>("/api/doctor/login", { cache: "no-store" });
      if (data.doctor) {
        fill(data.doctor);
        setTgInfo({ linked: Boolean(data.telegramLinked), ready: Boolean(data.telegramReady), bot: data.telegramBot ?? null });
        setStatus("ready");
      } else {
        setStatus("login");
      }
      return Boolean(data.doctor);
    } catch {
      setStatus("login");
      return false;
    }
  }

  useEffect(() => {
    let cancel = () => undefined as void;
    loadMe().then((ok) => {
      // Telegram ichida: Telegram'i bog'langan shifokor parolsiz kiradi
      cancel = whenTelegram(async () => {
        setInTg(true);
        if (ok) return;
        try {
          const res = await fetch("/api/telegram/doctor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: tgInitData() }),
          });
          if (res.ok) await loadMe();
        } catch {}
      });
    });
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bot orqali bog'lash: bir martalik havola ochiladi, botda Start bosiladi
  async function linkViaBot() {
    setBusy(true);
    try {
      const res = await api<{ url: string }>("/api/doctor/telegram-link", { method: "POST" });
      window.location.href = res.url;
      notify("Telegram ochilmoqda… Botda Start ni bosing, so‘ng shu sahifani yangilang.");
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function linkTelegram(unlink = false) {
    setBusy(true);
    try {
      await api(
        "/api/telegram/doctor",
        unlink ? { method: "DELETE" } : jsonInit("PUT", { initData: tgInitData() }),
      );
      setTgInfo((prev) => ({ ...prev, linked: !unlink }));
      notify(
        unlink
          ? "Telegram uzildi. Endi xabarnomalar kelmaydi."
          : "Telegram bog‘landi! Endi yangi savollar va qabul so‘rovlari shu yerga keladi.",
      );
      getWebApp()?.HapticFeedback?.impactOccurred("medium");
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      await api("/api/doctor/login", jsonInit("POST", { login, password }));
      setPassword("");
      await loadMe();
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/doctor/login", { method: "DELETE" });
    setDoctor(null);
    setStatus("login");
  }

  const setField = (key: keyof typeof FIELDS) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setRuField = (key: keyof DoctorRu) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setRu((prev) => ({ ...prev, [key]: e.target.value }));

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ url: string }>("/api/doctor/upload", { method: "POST", body });
      setForm((prev) => ({ ...prev, image: res.url }));
      notify("Rasm yuklandi. Saqlashni bosing.");
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) setStatus("login");
      else notify(e.message, true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ doctor: Doctor }>("/api/doctor/profile", jsonInit("PUT", { ...form, ru, newPassword }));
      fill(res.doctor);
      setNewPassword("");
      notify(newPassword ? "Profil va yangi parol saqlandi." : "Profil saqlandi. Saytda darhol ko‘rinadi.");
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) setStatus("login");
      else notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  const background = (
    <div className="mesh" aria-hidden="true">
      <i className="blob blob-1" />
      <i className="blob blob-2" />
      <i className="blob blob-3" />
    </div>
  );

  if (status === "loading") return <main className="adm-shell">{background}</main>;

  if (status === "login") {
    return (
      <main className="adm-shell">
        {background}
        <form className="adm-login glass" onSubmit={doLogin}>
          <h1>Shifokor kabineti</h1>
          <p>Admin bergan login va parol bilan kiring.</p>
          <input
            id="doc-login"
            placeholder="Login"
            autoComplete="username"
            autoCapitalize="none"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            autoFocus
          />
          <input
            id="doc-password"
            type="password"
            placeholder="Parol"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {loginError ? <div className="adm-error">{loginError}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Tekshirilmoqda…" : "Kirish"}
          </button>
          <a className="doc-back" href="/">
            ← Saytga qaytish
          </a>
        </form>
      </main>
    );
  }

  return (
    <main className="adm-shell">
      {background}

      <div className="adm-top">
        <div className="adm-bar glass">
          <span className="brand">
            <span className="brand-heart">♥</span>
            NeyroCardio · Shifokor
          </span>
          <div className="adm-bar-actions">
            <a className="btn btn-primary" href="/#savollar">
              Chatga o‘tish
            </a>
            <button className="btn btn-glass" type="button" onClick={logout}>
              Chiqish
            </button>
          </div>
        </div>
      </div>

      <div className="adm-wrap">
        <div className={`doc-hero glass tone-${doctor?.accent ?? "neyro"}`}>
          <div className="doc-hero-photo">
            {form.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image} alt="" />
            ) : (
              <span>{form.name.slice(0, 1)}</span>
            )}
          </div>
          <div>
            <span className="doctor-role">{form.role}</span>
            <h1 className="adm-title">{form.name || "Profil"}</h1>
            <p className="adm-sub">
              Bu yerda o‘z ma’lumotlaringizni o‘zgartirasiz. Chatda siz rasmingiz va “Shifokor” belgisi bilan
              ko‘rinasiz, keraksiz xabarlarni “O‘chirish” tugmasi bilan olib tashlaysiz.
            </p>
          </div>
        </div>

        <div className="adm-card glass doc-tg">
          <h2>Telegram xabarnomalari</h2>
          {!tgInfo.ready ? (
            <p className="adm-hint">Telegram bot hali sozlanmagan. Bu bo‘limni admin yoqadi.</p>
          ) : tgInfo.linked ? (
            <>
              <p className="doc-tg-status is-on">
                <i aria-hidden="true" /> Telegram bog‘langan
              </p>
              <p className="adm-hint">
                Yangi savollar va qabul so‘rovlari Telegram’ingizga keladi. Bot orqali kirsangiz, parolsiz
                avtomatik kirasiz.
              </p>
              <div className="adm-row">
                <button className="btn btn-glass" type="button" disabled={busy} onClick={() => linkTelegram(true)}>
                  Uzish
                </button>
              </div>
            </>
          ) : inTg ? (
            <>
              <p className="adm-hint">
                Telegram akkauntingizni bog‘lang: chatga yangi savol tushganda va bemor qabulga yozilganda
                bot sizga xabar yuboradi. Keyingi safar parolsiz kirasiz.
              </p>
              <div className="adm-row">
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => linkTelegram()}>
                  Telegram’imni bog‘lash
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="adm-hint">
                Tugmani bosing — Telegram ochiladi, botda <b>Start</b> ni bosing. Shundan keyin bemorlar bot orqali
                yozgan xabarlar va qabul so‘rovlari to‘g‘ridan-to‘g‘ri Telegram’ingizga keladi, javobni ham
                o‘sha yerda yozasiz.
              </p>
              <div className="adm-row">
                <button className="btn btn-primary" type="button" disabled={busy} onClick={linkViaBot}>
                  Telegram orqali bog‘lash ↗
                </button>
              </div>
            </>
          )}
        </div>

        <form className="adm-card glass" onSubmit={save}>
          <h2>Mening profilim</h2>
          <div className="adm-form">
            <div>
              <label htmlFor="p-name">Ism va familiya *</label>
              <input id="p-name" value={form.name} onChange={setField("name")} maxLength={80} required />
            </div>
            <div>
              <label htmlFor="p-role">Mutaxassisligi *</label>
              <input id="p-role" value={form.role} onChange={setField("role")} maxLength={60} required />
            </div>
            <div className="adm-full">
              <label htmlFor="p-desc">Qisqa tavsif (kartadagi yozuv)</label>
              <input id="p-desc" value={form.description} onChange={setField("description")} maxLength={160} />
            </div>
            <div>
              <label htmlFor="p-phone">Telefon *</label>
              <input id="p-phone" type="tel" value={form.phone} onChange={setField("phone")} required />
            </div>
            <div>
              <label htmlFor="p-tg">Telegram *</label>
              <input id="p-tg" value={form.telegram} onChange={setField("telegram")} required />
            </div>
            <div>
              <label htmlFor="p-ig">Instagram</label>
              <input id="p-ig" placeholder="@username" value={form.instagram} onChange={setField("instagram")} />
            </div>
            <div className="adm-full">
              <label htmlFor="p-img">Rasm (JPG, PNG yoki WEBP, 5 MB gacha)</label>
              <input
                id="p-img"
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadImage}
                disabled={uploading}
              />
              {uploading ? <p className="adm-hint">Yuklanmoqda…</p> : null}
            </div>
            <div className="adm-full">
              <label htmlFor="p-bio">Batafsil ma’lumot (“Batafsil” oynasida ko‘rinadi)</label>
              <textarea id="p-bio" value={form.bio} onChange={setField("bio")} maxLength={3000} />
            </div>
            <div>
              <label htmlFor="p-exp">Tajriba</label>
              <input id="p-exp" value={form.experience} onChange={setField("experience")} maxLength={120} />
            </div>
            <div>
              <label htmlFor="p-sched">Qabul vaqti</label>
              <input id="p-sched" value={form.schedule} onChange={setField("schedule")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="p-edu">Ta’lim</label>
              <input id="p-edu" value={form.education} onChange={setField("education")} maxLength={400} />
            </div>
            <div>
              <label htmlFor="p-addr">Manzil</label>
              <input id="p-addr" value={form.address} onChange={setField("address")} maxLength={200} />
            </div>
          </div>

          <details className="adm-ru" open={Object.values(ru).some(Boolean)}>
            <summary>
              Ruscha matnlar <span>ixtiyoriy — bo‘sh maydonda o‘zbekchasi ko‘rinadi</span>
            </summary>
            <div className="adm-form" lang="ru">
              <div>
                <label htmlFor="pr-name">Ism va familiya (RU)</label>
                <input id="pr-name" value={ru.name} onChange={setRuField("name")} maxLength={80} />
              </div>
              <div>
                <label htmlFor="pr-role">Mutaxassisligi (RU)</label>
                <input id="pr-role" value={ru.role} onChange={setRuField("role")} maxLength={60} />
              </div>
              <div className="adm-full">
                <label htmlFor="pr-desc">Qisqa tavsif (RU)</label>
                <input id="pr-desc" value={ru.description} onChange={setRuField("description")} maxLength={160} />
              </div>
              <div className="adm-full">
                <label htmlFor="pr-bio">Batafsil ma’lumot (RU)</label>
                <textarea id="pr-bio" value={ru.bio} onChange={setRuField("bio")} maxLength={3000} />
              </div>
              <div>
                <label htmlFor="pr-exp">Tajriba (RU)</label>
                <input id="pr-exp" value={ru.experience} onChange={setRuField("experience")} maxLength={120} />
              </div>
              <div>
                <label htmlFor="pr-sched">Qabul vaqti (RU)</label>
                <input id="pr-sched" value={ru.schedule} onChange={setRuField("schedule")} maxLength={200} />
              </div>
              <div>
                <label htmlFor="pr-edu">Ta’lim (RU)</label>
                <input id="pr-edu" value={ru.education} onChange={setRuField("education")} maxLength={400} />
              </div>
              <div>
                <label htmlFor="pr-addr">Manzil (RU)</label>
                <input id="pr-addr" value={ru.address} onChange={setRuField("address")} maxLength={200} />
              </div>
            </div>
          </details>

          <div className="adm-form" style={{ marginTop: 20 }}>
            <div>
              <label htmlFor="p-newpass">Yangi parol (o‘zgartirmasangiz bo‘sh qoldiring)</label>
              <input
                id="p-newpass"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kamida 8 ta belgi"
              />
            </div>
          </div>

          <div className="adm-row">
            <button className="btn btn-primary" type="submit" disabled={busy || uploading}>
              {busy ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      </div>

      {toast ? (
        <div className={`adm-toast glass${toast.error ? " is-error" : ""}`} role="status">
          <span>{toast.text}</span>
        </div>
      ) : null}
    </main>
  );
}
