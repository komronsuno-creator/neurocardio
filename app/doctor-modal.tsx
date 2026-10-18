"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DICT, doctorText } from "./lib/i18n";
import type { Doctor, Lang } from "./lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// "Batafsil" bosilganda sahifaning o'zida ochiladigan suyuq shisha oynasi
export default function DoctorModal({
  doctor,
  lang = "uz",
  onClose,
}: {
  doctor: Doctor | null;
  lang?: Lang;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<Doctor | null>(null); // yopilish animatsiyasi tugaguncha saqlanadi
  const [closing, setClosing] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => setMounted(true), []);

  // Ochish / yopish (animatsiya bilan)
  useEffect(() => {
    if (doctor) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setShown(doctor);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setShown(null);
      setClosing(false);
      lastFocus.current?.focus?.();
    }, 320);
    return () => window.clearTimeout(t);
  }, [doctor]);

  // Ochiq paytda: scroll qotadi, Escape yopadi, Tab oyna ichida aylanadi
  const open = shown !== null;
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  if (!mounted || !shown) return null;

  const d = shown;
  const t = DICT[lang].modal;
  const tr = (key: Parameters<typeof doctorText>[1]) => doctorText(d, key, lang);
  const name = tr("name");
  const bio = tr("bio");
  const facts = [
    { label: t.experience, value: tr("experience") },
    { label: t.education, value: tr("education") },
    { label: t.schedule, value: tr("schedule") },
    { label: t.address, value: tr("address") },
  ].filter((item) => item.value);

  return createPortal(
    <div
      className={`detail-overlay${closing ? " is-closing" : ""}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        className="detail-panel glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        data-glow
      >
        <button
          ref={closeRef}
          type="button"
          className="detail-close"
          aria-label={t.close}
          onClick={() => onCloseRef.current()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="detail-scroll">
          <div className="detail-head">
            <div className="detail-photo">
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.image} alt={name} draggable={false} />
              ) : (
                <span className="photo-fallback">{initials(name)}</span>
              )}
            </div>

            <div className="detail-titles">
              <span className="doctor-role">{tr("role")}</span>
              <h3 id="detail-title">{name}</h3>
              <p>{tr("description")}</p>
            </div>
          </div>

          {bio ? <p className="detail-bio">{bio}</p> : null}

          {facts.length > 0 ? (
            <dl className="detail-facts">
              {facts.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {!bio && facts.length === 0 ? (
            <p className="detail-empty">{t.empty}</p>
          ) : null}

          <div className="detail-actions">
            <a className="btn btn-primary" href={d.telegram} target="_blank" rel="noopener noreferrer">
              Telegram ↗
            </a>
            <a className="btn btn-glass" href={`tel:${d.phone}`}>
              ☎ {DICT[lang].doctors.call}
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
