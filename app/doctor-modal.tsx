"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Doctor } from "./lib/types";

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
  onClose,
}: {
  doctor: Doctor | null;
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
  const facts = [
    { label: "Tajriba", value: d.experience },
    { label: "Ta’lim", value: d.education },
    { label: "Qabul vaqti", value: d.schedule },
    { label: "Manzil", value: d.address },
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
          aria-label="Yopish"
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
                <img src={d.image} alt={d.name} draggable={false} />
              ) : (
                <span className="photo-fallback">{initials(d.name)}</span>
              )}
            </div>

            <div className="detail-titles">
              <span className="doctor-role">{d.role}</span>
              <h3 id="detail-title">{d.name}</h3>
              <p>{d.description}</p>
            </div>
          </div>

          {d.bio ? <p className="detail-bio">{d.bio}</p> : null}

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

          {!d.bio && facts.length === 0 ? (
            <p className="detail-empty">Shifokor haqida batafsil ma’lumot tez orada qo‘shiladi.</p>
          ) : null}

          <div className="detail-actions">
            <a className="btn btn-primary" href={d.telegram} target="_blank" rel="noopener noreferrer">
              Telegram ↗
            </a>
            <a className="btn btn-glass" href={`tel:${d.phone}`}>
              ☎ Qo‘ng‘iroq
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
