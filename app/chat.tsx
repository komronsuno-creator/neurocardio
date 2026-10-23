"use client";

// Savol-javob chati: bemorlar ism bilan yozadi, shifokorlar o'z login/paroli bilan kirib
// rasm va rang bilan ajralib turadi, keraksiz xabarlarni o'chira oladi.
// Yangi xabarlar bir necha soniyada so'raladi (faqat chat ekranda ko'rinib turganda).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DICT, doctorText } from "./lib/i18n";
import type { ChatDoctor, ChatMessage, Doctor, Lang } from "./lib/types";
import { getWebApp, tgInitData, tgUserName, whenTelegram } from "./lib/tg-client";

const POLL_MS = 4000;
const NAME_KEY = "nc_chat_name";
const MINE_KEY = "nc_chat_mine";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export default function Chat({ lang, doctors: initialDoctors }: { lang: Lang; doctors: Doctor[] }) {
  const t = DICT[lang].chat;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [doctors, setDoctors] = useState<ChatDoctor[]>(initialDoctors);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<Doctor | null>(null);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [mine, setMine] = useState<string[]>([]);
  const [tgName, setTgName] = useState("");
  const askedWriteRef = useRef(false);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastIdRef = useRef("");
  const stickRef = useRef(true);
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  // Saqlangan ism va o'z xabarlarim
  useEffect(() => {
    const saved = readLocal(NAME_KEY);
    setName(saved);
    setNameDraft(saved);
    try {
      setMine(JSON.parse(readLocal(MINE_KEY) || "[]") as string[]);
    } catch {}
  }, []);

  // Shifokor sifatida kirganmi?
  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor/login", { cache: "no-store" });
      const data = (await res.json()) as { doctor: Doctor | null };
      setMe(data.doctor);
      return data.doctor;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancel = () => undefined as void;
    loadMe().then((doctor) => {
      // Telegram Mini App: ism Telegram'dan; shifokorning Telegram'i bog'langan bo'lsa — parolsiz kiradi
      cancel = whenTelegram(async () => {
        setTgName(tgUserName());
        if (doctor) return;
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
  }, [loadMe]);

  // Yangi xabarlarni olish
  const poll = useCallback(async (full = false) => {
    const after = full ? "" : lastIdRef.current;
    try {
      const res = await fetch(`/api/chat${after ? `?after=${after}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[]; ids: string[]; doctors?: ChatDoctor[] };
      if (data.doctors) setDoctors(data.doctors);
      const alive = new Set(data.ids);
      const oldest = data.ids[0] ?? "";
      setMessages((prev) => {
        if (!data.ids.length) return [];
        const map = new Map((full ? [] : prev).map((m) => [m.id, m]));
        data.messages.forEach((m) => map.set(m.id, m));
        // Oxirgi xabarlar oynasida bo'lib, ro'yxatda yo'q bo'lsa — shifokor o'chirgan
        return Array.from(map.values())
          .filter((m) => m.id < oldest || alive.has(m.id))
          .sort((a, b) => (a.id < b.id ? -1 : 1));
      });
      const newest = data.ids[data.ids.length - 1];
      if (newest) lastIdRef.current = newest;
      setLoaded(true);
    } catch {}
  }, []);

  // Chat ekranda ko'rinib turganda va tab faol bo'lganda yangilanadi
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let visible = false;
    let timer = 0;
    let started = false;

    const tick = () => {
      window.clearTimeout(timer);
      if (!visible || document.hidden) return;
      poll(!started).finally(() => {
        started = true;
        timer = window.setTimeout(tick, POLL_MS);
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (visible && !was) tick();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    const onVis = () => {
      if (!document.hidden && visible) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(timer);
    };
  }, [poll]);

  // Pastga avtomatik tushish (foydalanuvchi tepani o'qiyotgan bo'lsa tushirmaydi)
  useEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  function saveName(event: React.FormEvent) {
    event.preventDefault();
    const clean = nameDraft.replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean.length < 2) return;
    setName(clean);
    writeLocal(NAME_KEY, clean);
    setEditingName(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    // Telegram'da birinchi xabardan oldin: bot shifokor javobini yubora olishi uchun ruxsat so'raladi
    const wa = getWebApp();
    if (wa && !askedWriteRef.current && !wa.initDataUnsafe.user?.allows_write_to_pm && !me) {
      askedWriteRef.current = true;
      try {
        if (wa.isVersionAtLeast("6.9")) wa.requestWriteAccess?.();
      } catch {}
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || tgName,
          initData: tgInitData(),
          text: body,
          replyTo: replyTo?.id ?? "",
          website: honeypotRef.current?.value ?? "",
        }),
      });
      const data = (await res.json()) as { message?: ChatMessage; error?: string };
      if (!res.ok || !data.message) {
        setError(data.error || t.error);
        return;
      }
      const msg = data.message;
      setText("");
      setReplyTo(null);
      stickRef.current = true;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      const nextMine = [...mine, msg.id].slice(-200);
      setMine(nextMine);
      writeLocal(MINE_KEY, JSON.stringify(nextMine));
    } catch {
      setError(t.error);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    setConfirmId("");
    const res = await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function logout() {
    await fetch("/api/doctor/login", { method: "DELETE" });
    setMe(null);
  }

  function onKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  // Sana ajratgichlari
  const dayLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t.today;
    if (d.toDateString() === yest.toDateString()) return t.yesterday;
    return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { day: "numeric", month: "long" });
  };
  const time = (ts: number) =>
    new Date(ts).toLocaleTimeString(lang === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit" });

  const canWrite = Boolean(me) || (Boolean(name || tgName) && !editingName);
  const mineSet = new Set(mine);

  let lastDay = "";

  return (
    <div className="chat-shell glass reveal" ref={sectionRef} data-glow>
      {/* Sarlavha qatori */}
      <div className="chat-top">
        <div className="chat-avatars" aria-hidden="true">
          {doctors.slice(0, 3).map((d) => (
            <span key={d.id} className={`chat-ava tone-${d.accent}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.image ? <img src={d.image} alt="" /> : initials(d.name)}
            </span>
          ))}
        </div>
        <div className="chat-top-text">
          <strong>NeyroCardio</strong>
          <span>
            <i className="chat-live" /> {t.online}
          </span>
        </div>
        {me ? (
          <div className="chat-me">
            <span>{t.asDoctor}</span>
            <a href="/doctor">{t.profile}</a>
            <button type="button" onClick={logout}>
              {t.logout}
            </button>
          </div>
        ) : null}
      </div>

      {/* Xabarlar */}
      <div className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
        {!loaded ? <p className="chat-empty">{t.loading}</p> : null}
        {loaded && messages.length === 0 ? <p className="chat-empty">{t.empty}</p> : null}

        {messages.map((m) => {
          const day = dayLabel(m.ts);
          const showDay = day !== lastDay;
          lastDay = day;
          const doc = m.kind === "doctor" && m.doctorId ? doctorMap.get(m.doctorId) : undefined;
          const docName = doc ? doctorText(doc as Doctor, "name", lang) : m.name;
          const isDoctor = m.kind === "doctor";
          const own = mineSet.has(m.id) || (isDoctor && me?.id === m.doctorId);

          return (
            <div key={m.id} className="chat-row-wrap">
              {showDay ? <div className="chat-day">{day}</div> : null}
              <div
                className={`chat-row${isDoctor ? ` is-doctor tone-${doc?.accent ?? "neyro"}` : ""}${own ? " is-own" : ""}`}
              >
                <div className="chat-ava-lg" aria-hidden="true">
                  {isDoctor && doc?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={doc.image} alt="" />
                  ) : (
                    initials(docName)
                  )}
                </div>

                <div className="chat-bubble">
                  <div className="chat-meta">
                    <strong>{own && !isDoctor ? `${m.name} · ${t.you}` : docName}</strong>
                    {isDoctor ? (
                      <span className="chat-badge">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M8 1.5 9.7 3l2.2-.3.6 2.1 1.9 1.2-.8 2 .8 2-1.9 1.2-.6 2.1-2.2-.3L8 14.5 6.3 13l-2.2.3-.6-2.1-1.9-1.2.8-2-.8-2 1.9-1.2.6-2.1L6.3 3 8 1.5Z" />
                          <path d="m5.6 8.1 1.6 1.6 3.3-3.3" fill="none" />
                        </svg>
                        {doc ? doctorText(doc as Doctor, "role", lang) : t.doctorBadge}
                      </span>
                    ) : null}
                    <time dateTime={new Date(m.ts).toISOString()}>{time(m.ts)}</time>
                  </div>

                  {m.replyTo ? (
                    <div className="chat-quote">
                      <b>{m.replyTo.name}</b>
                      <span>{m.replyTo.text}</span>
                    </div>
                  ) : null}

                  <p>{m.text}</p>

                  <div className="chat-actions">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(m);
                          inputRef.current?.focus();
                        }}
                      >
                        {t.reply}
                      </button>
                    ) : null}
                    {me ? (
                      confirmId === m.id ? (
                        <span className="chat-confirm">
                          {t.confirmRemove}
                          <button type="button" className="is-danger" onClick={() => remove(m.id)}>
                            {t.yes}
                          </button>
                          <button type="button" onClick={() => setConfirmId("")}>
                            {t.no}
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="is-danger" onClick={() => setConfirmId(m.id)}>
                          {t.remove}
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Yozish joyi */}
      <div className="chat-bottom">
        {!canWrite ? (
          <form className="chat-name" onSubmit={saveName}>
            <label htmlFor="chat-name">{t.namePrompt}</label>
            <div>
              <input
                id="chat-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t.namePh}
                autoComplete="given-name"
                maxLength={40}
                minLength={2}
                required
              />
              <button className="btn btn-primary" type="submit" disabled={nameDraft.trim().length < 2}>
                {t.join}
              </button>
            </div>
          </form>
        ) : (
          <form className="chat-compose" onSubmit={send}>
            {replyTo ? (
              <div className="chat-replying">
                <span>
                  {t.replyingTo} <b>{replyTo.name}</b> — {replyTo.text.slice(0, 80)}
                </span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={t.cancel}>
                  ×
                </button>
              </div>
            ) : null}

            <div className="chat-input">
              <textarea
                id="chat-text"
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                placeholder={t.placeholder}
                rows={1}
                maxLength={1000}
                aria-label={t.placeholder}
              />
              <input
                ref={honeypotRef}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="chat-hp"
                aria-hidden="true"
              />
              <button className="chat-send" type="submit" disabled={!text.trim() || sending} aria-label={t.send}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" />
                </svg>
              </button>
            </div>

            <div className="chat-under">
              {me ? null : (
                <span>
                  {t.asName} <b>{name || tgName}</b>{" "}
                  <button type="button" onClick={() => setEditingName(true)}>
                    {t.changeName}
                  </button>
                </span>
              )}
              {error ? <span className="chat-error">{error}</span> : <span>{text.length}/1000</span>}
            </div>
          </form>
        )}
        <p className="chat-privacy">{t.privacy}</p>
      </div>
    </div>
  );
}
