"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "../extra.css";
import type { Doctor, Video } from "../lib/types";
import { parseYouTube } from "../lib/youtube";

type Status = "loading" | "login" | "ready" | "unconfigured";
type Toast = { text: string; error?: boolean } | null;

const EMPTY_DOCTOR = {
  name: "",
  role: "",
  description: "",
  phone: "",
  telegram: "",
  image: "",
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

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [tab, setTab] = useState<"videos" | "doctors">("videos");
  const [videos, setVideos] = useState<Video[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);

  // login
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // video form
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  // doctor form
  const [form, setForm] = useState({ ...EMPTY_DOCTOR });
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef(0);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadContent = useCallback(async () => {
    const data = await api<{ doctors: Doctor[]; videos: Video[] }>("/api/content", { cache: "no-store" });
    setDoctors(data.doctors);
    setVideos(data.videos);
  }, []);

  // Kirganmi yoki yo'qmi
  useEffect(() => {
    (async () => {
      try {
        const s = await api<{ configured: boolean; authed: boolean }>("/api/admin/login", { cache: "no-store" });
        if (!s.configured) return setStatus("unconfigured");
        if (!s.authed) return setStatus("login");
        await loadContent();
        setStatus("ready");
      } catch {
        setStatus("login");
      }
    })();
  }, [loadContent]);

  // Har qanday so'rovda sessiya tugagan bo'lsa login oynasiga qaytadi
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setStatus("login");
        setLoginError("Sessiya tugadi. Qayta kiring.");
      } else {
        notify(e.message, true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      await api("/api/admin/login", jsonInit("POST", { password }));
      setPassword("");
      await loadContent();
      setStatus("ready");
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setStatus("login");
  }

  /* ---------- Videolar ---------- */

  const parsed = parseYouTube(videoUrl);

  function addVideo(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed) return notify("YouTube havolasi noto‘g‘ri.", true);
    run(async () => {
      await api("/api/admin/videos", jsonInit("POST", { url: videoUrl, title: videoTitle }));
      setVideoUrl("");
      setVideoTitle("");
      await loadContent();
      notify("Video qo‘shildi.");
    });
  }

  function removeVideo(video: Video) {
    if (!window.confirm(`“${video.title}” videosini o‘chirasizmi?`)) return;
    run(async () => {
      await api(`/api/admin/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" });
      await loadContent();
      notify("Video o‘chirildi.");
    });
  }

  /* ---------- Shifokorlar ---------- */

  const setField = (key: keyof typeof EMPTY_DOCTOR) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function resetForm() {
    setForm({ ...EMPTY_DOCTOR });
    setEditId(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function startEdit(doctor: Doctor) {
    setEditId(doctor.id);
    setForm({
      name: doctor.name,
      role: doctor.role,
      description: doctor.description,
      phone: doctor.phone,
      telegram: doctor.telegram,
      image: doctor.image,
      bio: doctor.bio ?? "",
      experience: doctor.experience ?? "",
      education: doctor.education ?? "",
      schedule: doctor.schedule ?? "",
      address: doctor.address ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ url: string }>("/api/admin/upload", { method: "POST", body });
      setForm((prev) => ({ ...prev, image: res.url }));
      notify("Rasm yuklandi.");
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setStatus("login");
      } else {
        notify(e.message, true);
      }
    } finally {
      setUploading(false);
    }
  }

  function saveDoctor(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      if (editId) {
        await api("/api/admin/doctors", jsonInit("PUT", { ...form, id: editId }));
        notify("Shifokor ma’lumotlari saqlandi.");
      } else {
        await api("/api/admin/doctors", jsonInit("POST", form));
        notify("Shifokor qo‘shildi.");
      }
      resetForm();
      await loadContent();
    });
  }

  function removeDoctor(doctor: Doctor) {
    if (!window.confirm(`${doctor.name} ni o‘chirasizmi?`)) return;
    run(async () => {
      await api(`/api/admin/doctors?id=${encodeURIComponent(doctor.id)}`, { method: "DELETE" });
      if (editId === doctor.id) resetForm();
      await loadContent();
      notify("Shifokor o‘chirildi.");
    });
  }

  /* ---------- Ko'rinish ---------- */

  const background = (
    <div className="mesh" aria-hidden="true">
      <i className="blob blob-1" />
      <i className="blob blob-2" />
      <i className="blob blob-3" />
    </div>
  );

  if (status === "loading") {
    return <main className="adm-shell">{background}</main>;
  }

  if (status === "unconfigured") {
    return (
      <main className="adm-shell">
        {background}
        <div className="adm-login glass">
          <h1>Admin panel</h1>
          <p>
            Parol hali o‘rnatilmagan. Loyiha papkasidagi <code>.env.local</code> fayliga{" "}
            <code>ADMIN_PASSWORD=sizning_parolingiz</code> qatorini qo‘shing va serverni qayta ishga
            tushiring.
          </p>
        </div>
      </main>
    );
  }

  if (status === "login") {
    return (
      <main className="adm-shell">
        {background}
        <form className="adm-login glass" onSubmit={login}>
          <h1>Admin panel</h1>
          <p>NeyroCardio saytini boshqarish uchun parolni kiriting.</p>
          <input
            type="password"
            placeholder="Parol"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          {loginError ? <div className="adm-error">{loginError}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Tekshirilmoqda…" : "Kirish"}
          </button>
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
            NeyroCardio · Admin
          </span>
          <div className="adm-bar-actions">
            <a className="btn btn-glass" href="/">
              Saytga qaytish
            </a>
            <button className="btn btn-glass" type="button" onClick={logout}>
              Chiqish
            </button>
          </div>
        </div>
      </div>

      <div className="adm-wrap">
        <h1 className="adm-title">Saytni boshqarish</h1>
        <p className="adm-sub">
          Videolar va shifokorlarni shu yerdan qo‘shing yoki o‘chiring. O‘zgarishlar saytda darhol
          ko‘rinadi.
        </p>

        <div className="adm-tabs glass" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "videos"}
            className={`adm-tab${tab === "videos" ? " is-active" : ""}`}
            onClick={() => setTab("videos")}
          >
            Videolar ({videos.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "doctors"}
            className={`adm-tab${tab === "doctors" ? " is-active" : ""}`}
            onClick={() => setTab("doctors")}
          >
            Shifokorlar ({doctors.length})
          </button>
        </div>

        {tab === "videos" ? (
          <>
            <form className="adm-card glass" onSubmit={addVideo}>
              <h2>Video qo‘shish</h2>
              <div className="adm-form">
                <div className="adm-full">
                  <label htmlFor="v-url">YouTube havolasi</label>
                  <input
                    id="v-url"
                    type="text"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    required
                  />
                  <p className="adm-hint">
                    watch, youtu.be, shorts va embed havolalari ishlaydi. Havolada vaqt bo‘lsa
                    (<code>&amp;t=55</code>), video shu soniyadan boshlanadi.
                  </p>
                </div>
                <div className="adm-full">
                  <label htmlFor="v-title">Sarlavha (ixtiyoriy)</label>
                  <input
                    id="v-title"
                    type="text"
                    placeholder="Bo‘sh qoldirsangiz, YouTube’dagi nomi olinadi"
                    value={videoTitle}
                    maxLength={160}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>
              </div>

              {videoUrl.trim() ? (
                <div className="adm-preview">
                  {parsed ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://i.ytimg.com/vi/${parsed.id}/mqdefault.jpg`} alt="" />
                      <span>
                        Video topildi: <b>{parsed.id}</b>
                        {parsed.start ? ` · ${parsed.start}-soniyadan boshlanadi` : ""}
                      </span>
                    </>
                  ) : (
                    <span>Havola YouTube videosiga o‘xshamaydi.</span>
                  )}
                </div>
              ) : null}

              <div className="adm-row">
                <button className="btn btn-primary" type="submit" disabled={busy || !parsed}>
                  Qo‘shish
                </button>
              </div>
            </form>

            <div className="adm-card glass">
              <h2>Qo‘shilgan videolar</h2>
              {videos.length === 0 ? (
                <p className="adm-empty">Hozircha video yo‘q.</p>
              ) : (
                <div className="adm-list">
                  {videos.map((video) => (
                    <div className="adm-item" key={video.id}>
                      <div className="adm-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" />
                      </div>
                      <div>
                        <strong>{video.title}</strong>
                        <small>
                          youtu.be/{video.id}
                          {video.start ? ` · ${video.start}s` : ""}
                        </small>
                      </div>
                      <div className="adm-item-actions">
                        <button
                          type="button"
                          className="adm-btn-danger"
                          disabled={busy}
                          onClick={() => removeVideo(video)}
                        >
                          O‘chirish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <form className="adm-card glass" onSubmit={saveDoctor}>
              <h2>{editId ? "Shifokorni tahrirlash" : "Shifokor qo‘shish"}</h2>
              <div className="adm-form">
                <div>
                  <label htmlFor="d-name">Ism va familiya *</label>
                  <input id="d-name" value={form.name} onChange={setField("name")} maxLength={80} required />
                </div>
                <div>
                  <label htmlFor="d-role">Mutaxassisligi *</label>
                  <input
                    id="d-role"
                    placeholder="Masalan: Nevrolog"
                    value={form.role}
                    onChange={setField("role")}
                    maxLength={60}
                    required
                  />
                </div>
                <div className="adm-full">
                  <label htmlFor="d-desc">Qisqa tavsif (kartadagi yozuv)</label>
                  <input
                    id="d-desc"
                    placeholder="Masalan: Nevrologiya mutaxassisi"
                    value={form.description}
                    onChange={setField("description")}
                    maxLength={160}
                  />
                </div>
                <div>
                  <label htmlFor="d-phone">Telefon *</label>
                  <input
                    id="d-phone"
                    type="tel"
                    placeholder="+998901234567"
                    value={form.phone}
                    onChange={setField("phone")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="d-tg">Telegram *</label>
                  <input
                    id="d-tg"
                    placeholder="@username yoki https://t.me/username"
                    value={form.telegram}
                    onChange={setField("telegram")}
                    required
                  />
                </div>

                <div className="adm-full">
                  <label htmlFor="d-img">Rasm (JPG, PNG yoki WEBP, 5 MB gacha)</label>
                  <input
                    id="d-img"
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadImage}
                    disabled={uploading}
                  />
                  <p className="adm-hint">
                    {uploading ? "Yuklanmoqda…" : "Yoki rasm manzilini qo‘lda yozing (masalan /doctor-3.png):"}
                  </p>
                  <input
                    aria-label="Rasm manzili"
                    placeholder="/api/uploads/... yoki /doctor-3.png"
                    value={form.image}
                    onChange={setField("image")}
                  />
                  {form.image ? (
                    <div className="adm-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.image}
                        alt=""
                        style={{ width: 72, aspectRatio: "4 / 5", borderRadius: 12 }}
                      />
                      <span>Rasm ko‘rinishi</span>
                    </div>
                  ) : null}
                </div>

                <div className="adm-full">
                  <label htmlFor="d-bio">Batafsil ma’lumot (“Batafsil” oynasida ko‘rinadi)</label>
                  <textarea
                    id="d-bio"
                    placeholder="Shifokor haqida, qaysi kasalliklar bilan shug‘ullanishi…"
                    value={form.bio}
                    onChange={setField("bio")}
                    maxLength={3000}
                  />
                </div>
                <div>
                  <label htmlFor="d-exp">Tajriba</label>
                  <input
                    id="d-exp"
                    placeholder="Masalan: 10 yildan ortiq"
                    value={form.experience}
                    onChange={setField("experience")}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label htmlFor="d-sched">Qabul vaqti</label>
                  <input
                    id="d-sched"
                    placeholder="Masalan: Du–Shan, 09:00–18:00"
                    value={form.schedule}
                    onChange={setField("schedule")}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label htmlFor="d-edu">Ta’lim</label>
                  <input id="d-edu" value={form.education} onChange={setField("education")} maxLength={400} />
                </div>
                <div>
                  <label htmlFor="d-addr">Manzil</label>
                  <input id="d-addr" value={form.address} onChange={setField("address")} maxLength={200} />
                </div>
              </div>

              <div className="adm-row">
                <button className="btn btn-primary" type="submit" disabled={busy || uploading}>
                  {editId ? "Saqlash" : "Qo‘shish"}
                </button>
                {editId ? (
                  <button className="btn btn-glass" type="button" onClick={resetForm}>
                    Bekor qilish
                  </button>
                ) : null}
              </div>
            </form>

            <div className="adm-card glass">
              <h2>Shifokorlar</h2>
              {doctors.length === 0 ? (
                <p className="adm-empty">Hozircha shifokor yo‘q.</p>
              ) : (
                <div className="adm-list">
                  {doctors.map((doctor) => (
                    <div className="adm-item" key={doctor.id}>
                      <div className="adm-avatar">
                        {doctor.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={doctor.image} alt="" loading="lazy" />
                        ) : (
                          doctor.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <strong>{doctor.name}</strong>
                        <small>
                          {doctor.role} · {doctor.phone}
                        </small>
                      </div>
                      <div className="adm-item-actions">
                        <button type="button" className="adm-btn-soft" onClick={() => startEdit(doctor)}>
                          Tahrirlash
                        </button>
                        <button
                          type="button"
                          className="adm-btn-danger"
                          disabled={busy}
                          onClick={() => removeDoctor(doctor)}
                        >
                          O‘chirish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast ? (
        <div className={`adm-toast glass${toast.error ? " is-error" : ""}`} role="status">
          <span>{toast.text}</span>
        </div>
      ) : null}
    </main>
  );
}
