"use client";

import { useEffect, useRef, useState } from "react";
import "./extra.css";
import "./premium.css";
import DoctorModal from "./doctor-modal";
import Icon, { type IconName } from "./icons";
import { DICT, LANG_COOKIE, doctorText, videoTitle } from "./lib/i18n";
import type { Doctor, Lang, Video } from "./lib/types";

const directionIcons: IconName[] = ["brain", "heart", "shield", "moon"];
const trustIcons: IconName[] = ["stethoscope", "flask", "play", "send"];
const menuIds = ["yonalishlar", "shifokorlar", "videolar", "qabul"] as const;


// Tungi/kunduzgi rejim: oddiy JavaScript, React'ga bog'liq emas.
// Sahifa HTML'i yuklanishi bilan ishlaydi va tugmani bosganda rejimni almashtiradi.
const themeScript = `
(function () {
  if (window.__ncTheme) return;
  window.__ncTheme = true;

  var root = document.documentElement;
  var busy = false;

  function current() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function sync() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    var dark = current() === "dark";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    var ru = root.lang === "ru";
    btn.setAttribute("aria-label", dark ? (ru ? "Светлая тема" : "Kunduzgi rejimga o\u2018tish") : (ru ? "Тёмная тема" : "Tungi rejimga o\u2018tish"));
  }

  function apply(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
  }

  if (!root.getAttribute("data-theme")) {
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    if (saved !== "dark" && saved !== "light") {
      saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", saved);
  }
  sync();
  document.addEventListener("DOMContentLoaded", sync);

  document.addEventListener("click", function (event) {
    var target = event.target;
    var btn = target && target.closest ? target.closest(".theme-toggle") : null;
    if (!btn) return;
    if (busy) return;

    var next = current() === "dark" ? "light" : "dark";
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) { apply(next); return; }

    busy = true;
    function done() { busy = false; root.classList.remove("theme-fade"); }

    // 1) Eng silliq usul: eski va yangi ko'rinish bir-biriga aralashib o'tadi
    if (document.startViewTransition) {
      try {
        var vt = document.startViewTransition(function () { apply(next); });
        vt.finished.then(done, done);
        setTimeout(done, 1500);
        return;
      } catch (e) {}
    }

    // 2) Eski brauzerlar uchun: ranglar yumshoq o'zgaradi
    root.classList.add("theme-fade");
    apply(next);
    setTimeout(done, 700);
  }, true);
})();
`;

export default function Home({
  doctors,
  videos,
  initialLang = "uz",
}: {
  doctors: Doctor[];
  videos: Video[];
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = DICT[lang];
  const menuLinks = [
    { href: `#${menuIds[0]}`, label: t.nav.directions },
    { href: `#${menuIds[1]}`, label: t.nav.doctors },
    { href: `#${menuIds[2]}`, label: t.nav.videos },
    { href: `#${menuIds[3]}`, label: t.nav.contact },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [year, setYear] = useState(2026);
  const [detail, setDetail] = useState<Doctor | null>(null);

  // Bosh ekrandagi aylanma animatsiya aynan 2 ta shifokorga mo'ljallangan: dizayn o'zgarmasligi uchun birinchi ikkitasi ko'rsatiladi
  const heroDoctors = doctors.slice(0, 2);

  const navRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  // Telefon menyusi ochiq bo'lganda Escape bilan yopish
  useEffect(() => {
    if (!menuOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Scroll effektlari: paydo bo'lish, progress chizig'i, swipe egilishi, parallaks.
  // Hammasi yengil: IntersectionObserver + bitta rAF, o'zgaruvchilar faqat kerakli elementga yoziladi.
  useEffect(() => {
    const root = document.documentElement;
    const touch = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasIO = "IntersectionObserver" in window;

    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const swipeCards = Array.from(
      document.querySelectorAll<HTMLElement>(".direction-card, .doctor-card"),
    );
    const videoGrid = document.querySelector<HTMLElement>(".video-grid");
    const videoCards = Array.from(document.querySelectorAll<HTMLElement>(".video-card"));
    const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    const mesh = document.querySelector<HTMLElement>(".mesh");
    const stage = document.querySelector<HTMLElement>(".hero-stage");
    const heroContent = document.querySelector<HTMLElement>(".hero-content");
    const navLinksEl = document.querySelector<HTMLElement>(".nav-links");
    const lens = navLinksEl?.querySelector<HTMLElement>(".nav-lens") ?? null;
    const navAnchors = navLinksEl
      ? Array.from(navLinksEl.querySelectorAll<HTMLAnchorElement>("a"))
      : [];
    const spyTargets = navAnchors.map((a) => document.getElementById(a.hash.slice(1)));
    const bar = progressRef.current;
    let dbg: HTMLDivElement | null = null;
    const dbgText = () =>
      `JS ishlayapti | sensor:${touch} | harakat:${!calm} | IO:${hasIO} | fx:${root.classList.contains("swipe-fx")} | tezlik:${vel.toFixed(2)} | ekrandagi:${inView.size}`;

    const clamp = (value: number, min = 0, max = 1) =>
      Math.min(max, Math.max(min, value));

    // 1) Paydo bo'lish: avval ko'rinib turganlar, qolganlari kuzatuvchi orqali
    const pending: HTMLElement[] = [];
    const vh0 = window.innerHeight;
    reveals.forEach((el) => {
      if (el.getBoundingClientRect().top < vh0 * 0.93) el.classList.add("is-visible");
      else pending.push(el);
    });
    root.classList.add("js-reveal");

    let revealIn: IntersectionObserver | null = null;
    let revealOut: IntersectionObserver | null = null;
    if (hasIO) {
      // Ko'rinishga kirganda animatsiya bilan chiqadi
      revealIn = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("is-visible");
          });
        },
        { rootMargin: "0px 0px -7% 0px" },
      );
      // To'liq chiqib ketganda qayta tayyorlanadi: yuqoridan chiqsa tepadan, pastdan chiqsa pastdan qaytadi
      revealOut = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.style.setProperty("--ry", entry.boundingClientRect.top < 0 ? "-34px" : "34px");
          el.classList.remove("is-visible");
        });
      });
      reveals.forEach((el) => {
        revealIn!.observe(el);
        revealOut!.observe(el);
      });
    } else {
      pending.forEach((el) => el.classList.add("is-visible"));
    }

    // 2) Swipe effekti (telefon): kartalar tezlikka qarab egiladi, to'xtaganda qaytadi
    const useSwipe = touch && !calm && hasIO;
    const flips = new Map<HTMLElement, number>();
    swipeCards.forEach((el, i) => flips.set(el, i % 2 === 0 ? 1 : -1));

    // Matnlar: swipe tezligiga qarab biroz ortda qoladi (chuqurroq = ko'proq)
    const depthMap = new Map<HTMLElement, number>();
    const dragGroups: [string, number][] = [
      [".hero-card h1", 10],
      [".hero-card p", 16],
      [".heading .tag, .appointment-copy .tag", 6],
      [".heading h2, .appointment-copy h2", 14],
      [".heading p, .appointment-copy p", 20],
      [".appointment-points li", 24],
    ];
    dragGroups.forEach(([selector, depth]) => {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => depthMap.set(el, depth));
    });
    const inView = new Set<HTMLElement>();
    let viewIO: IntersectionObserver | null = null;

    if (useSwipe) {
      root.classList.add("swipe-fx");
      viewIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const el = entry.target as HTMLElement;
            if (entry.isIntersecting) {
              inView.add(el);
            } else {
              inView.delete(el);
              el.style.rotate = "";
              el.style.scale = "";
              el.style.translate = "";
            }
          });
        },
        { rootMargin: "80px 0px" },
      );
      swipeCards.forEach((el) => viewIO!.observe(el));
      depthMap.forEach((_, el) => viewIO!.observe(el));
    }

    let vel = 0;
    let prevY = window.scrollY;
    let velRaf = 0;

    function velTick() {
      const y = window.scrollY;
      const dy = y - prevY;
      prevY = y;

      vel += (clamp(dy / 18, -1, 1) - vel) * 0.22;
      const idle = dy === 0 && Math.abs(vel) < 0.004;
      if (idle) vel = 0;

      const rot = (vel * 3).toFixed(2);
      const scl = (1 - Math.abs(vel) * 0.07).toFixed(3);

      inView.forEach((el) => {
        const depth = depthMap.get(el);
        if (idle) {
          el.style.rotate = "";
          el.style.scale = "";
          el.style.translate = "";
        } else if (depth !== undefined) {
          el.style.translate = `0 ${(vel * depth).toFixed(1)}px`;
        } else {
          el.style.rotate = `${Number(rot) * (flips.get(el) ?? 1)}deg`;
          el.style.scale = scl;
        }
      });

      velRaf = idle ? 0 : window.requestAnimationFrame(velTick);
    }

    // 3) Videolarni yon tomonga surganda markazdagisi kattalashadi
    function updateVideos() {
      if (!videoGrid) return;

      if (videoGrid.scrollWidth <= videoGrid.clientWidth + 2) {
        videoCards.forEach((card) => card.style.removeProperty("--vc"));
        return;
      }

      const g = videoGrid.getBoundingClientRect();
      const center = g.left + g.width / 2;

      videoCards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center) / (g.width * 0.7);
        card.style.setProperty("--vc", clamp(1 - d).toFixed(3));
      });
    }

    // 4) Scroll: progress chizig'i, menyu (shisha kapsula), parallaks
    let ticking = false;
    let lastSy = -1;
    let lastSpyY = -999;
    let hovering = false;
    let activeLink: HTMLAnchorElement | null = null;

    // Menyudagi "suyuq shisha" ko'rsatkich tanlangan havola ostiga suzib boradi
    function placeLens(link: HTMLElement | null) {
      if (!lens || !navLinksEl || navLinksEl.offsetParent === null) return;
      if (!link) {
        lens.style.setProperty("--lo", "0");
        return;
      }
      lens.style.setProperty("--lx", `${link.offsetLeft}px`);
      lens.style.setProperty("--lw", `${link.offsetWidth}px`);
      lens.style.setProperty("--lo", "1");
    }

    function spy(y: number, vh: number) {
      if (!navAnchors.length || Math.abs(y - lastSpyY) < 12) return;
      lastSpyY = y;

      let current: HTMLAnchorElement | null = null;
      if (y > 80) {
        for (let i = 0; i < spyTargets.length; i += 1) {
          const section = spyTargets[i];
          if (section && section.getBoundingClientRect().top <= vh * 0.38) {
            current = navAnchors[i];
          }
        }
      }

      if (current !== activeLink) {
        activeLink?.classList.remove("is-current");
        current?.classList.add("is-current");
        activeLink = current;
        if (!hovering) placeLens(activeLink);
      }
    }

    function onLinkOver(event: PointerEvent) {
      const link = (event.target as HTMLElement | null)?.closest<HTMLElement>("a");
      if (!link) return;
      hovering = true;
      placeLens(link);
    }

    function onLinkLeave() {
      hovering = false;
      placeLens(activeLink);
    }

    function update() {
      ticking = false;

      const vh = window.innerHeight;
      const y = window.scrollY;

      const sy = Math.min(y, vh * 1.2);
      if (sy !== lastSy) {
        lastSy = sy;
        stage?.style.setProperty("--sy", String(sy));
        heroContent?.style.setProperty("--sy", String(sy));
      }
      if (mesh && !touch) mesh.style.setProperty("--scr", String(y));

      const max = root.scrollHeight - vh;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;

      // Menyu: pastga tushganda ixchamlashadi, yorug'lik chizig'i scrollga qarab suzadi
      const nav = navRef.current;
      if (nav) {
        nav.classList.toggle("is-scrolled", y > 24);
        nav.style.setProperty("--nav-x", String(Math.round(((y * 0.7) % 1700) - 340)));
      }

      spy(y, vh);
    }

    function onScroll() {
      if (dbg) dbg.textContent = dbgText();
      if (useSwipe && !velRaf) {
        prevY = window.scrollY;
        velRaf = window.requestAnimationFrame(velTick);
      }
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    // Sichqoncha: shisha yorug'ligi va yengil 3D qiyalik (faqat kompyuterda)
    let tiltEl: HTMLElement | null = null;

    function resetTilt() {
      if (tiltEl) tiltEl.style.rotate = "";
      tiltEl = null;
    }

    function onPointerMove(event: PointerEvent) {
      const el = event.target as HTMLElement | null;

      const glow = el?.closest<HTMLElement>("[data-glow]");
      if (glow) {
        const rect = glow.getBoundingClientRect();
        glow.style.setProperty("--px", `${event.clientX - rect.left}px`);
        glow.style.setProperty("--py", `${event.clientY - rect.top}px`);
      }

      const card = el?.closest<HTMLElement>(".direction-card, .doctor-card, .hero-card") ?? null;
      if (tiltEl && tiltEl !== card) tiltEl.style.rotate = "";
      tiltEl = card;
      if (card) {
        const r = card.getBoundingClientRect();
        const dx = ((event.clientX - r.left) / r.width) * 2 - 1;
        const dy = ((event.clientY - r.top) / r.height) * 2 - 1;
        const max = card.classList.contains("hero-card") ? 2.2 : 4.5;
        const mag = Math.min(1, Math.hypot(dx, dy));
        card.style.rotate = `${(-dy).toFixed(3)} ${dx.toFixed(3)} 0 ${(max * mag).toFixed(2)}deg`;
      }
    }

    // 5) Raqamlar 0 dan sanab chiqadi (kirish animatsiyasidan keyin)
    const skipIntro = root.classList.contains("no-intro");
    let countTimer = 0;
    let countRaf = 0;

    if (counters.length && !calm) {
      const label = (el: HTMLElement, n: number) =>
        `${n}${el.dataset.suffix ?? ""}`;
      counters.forEach((el) => {
        el.textContent = label(el, 0);
      });

      countTimer = window.setTimeout(
        () => {
          const t0 = performance.now();
          const step = (now: number) => {
            const k = clamp((now - t0) / 1500);
            const eased = 1 - Math.pow(1 - k, 3);
            counters.forEach((el) => {
              el.textContent = label(el, Math.round(Number(el.dataset.count) * eased));
            });
            if (k < 1) countRaf = window.requestAnimationFrame(step);
          };
          countRaf = window.requestAnimationFrame(step);
        },
        skipIntro ? 400 : 2300,
      );
    }

    // Kirish animatsiyasi shu sessiyada bir marta ko'rsatiladi (yangilaganda qaytarilmaydi)
    const introTimer = window.setTimeout(() => {
      try {
        sessionStorage.setItem("nc_intro", "1");
      } catch {}
    }, 3000);

    function onLensResize() {
      placeLens(hovering ? null : activeLink);
    }

    update();
    updateVideos();
    // Shrift yuklangach havola o'lchamlari o'zgaradi: ko'rsatkichni qayta joylaymiz
    document.fonts?.ready.then(() => placeLens(activeLink)).catch(() => {});

    // Diagnostika: manzil oxiriga ?debug qo'shsangiz, tepada holat yozuvi chiqadi
    if (window.location.search.includes("debug")) {
      dbg = document.createElement("div");
      dbg.style.cssText =
        "position:fixed;left:6px;right:6px;bottom:6px;z-index:99999;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.82);color:#7CFC9A;font:11px/1.4 monospace;pointer-events:none;";
      dbg.textContent = dbgText();
      document.body.appendChild(dbg);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", onScroll);
    if (!touch) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", resetTilt);
    }
    navLinksEl?.addEventListener("pointerover", onLinkOver);
    navLinksEl?.addEventListener("pointerleave", onLinkLeave);
    window.addEventListener("resize", onLensResize);
    videoGrid?.addEventListener("scroll", updateVideos, { passive: true });

    const t1 = window.setTimeout(update, 300);
    const t2 = window.setTimeout(update, 1200);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", resetTilt);
      navLinksEl?.removeEventListener("pointerover", onLinkOver);
      navLinksEl?.removeEventListener("pointerleave", onLinkLeave);
      window.removeEventListener("resize", onLensResize);
      resetTilt();
      videoGrid?.removeEventListener("scroll", updateVideos);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(countTimer);
      window.clearTimeout(introTimer);
      window.cancelAnimationFrame(countRaf);
      window.cancelAnimationFrame(velRaf);
      dbg?.remove();
      revealIn?.disconnect();
      revealOut?.disconnect();
      viewIO?.disconnect();
      swipeCards.forEach((el) => {
        el.style.rotate = "";
        el.style.scale = "";
      });
      depthMap.forEach((_, el) => {
        el.style.translate = "";
      });
      root.classList.remove("swipe-fx");
      root.classList.remove("js-reveal");
    };
  }, []);

  // Telefonda sahifa chetlariga tortganda:
  // tepadan pastga tortsa yangilanadi, pastdan tepaga tortsa elastik qaytadi
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
    if (!touch) return;

    const shell = document.querySelector<HTMLElement>(".site-shell");
    const ptr = document.querySelector<HTMLElement>(".ptr");
    const glowTop = document.querySelector<HTMLElement>(".ptr-glow:not(.ptr-glow-b)");
    const glowBottom = document.querySelector<HTMLElement>(".ptr-glow-b");
    if (!shell || !ptr || !glowTop || !glowBottom) return;

    const MAX = 130;
    const THRESHOLD = 70;
    const HOLD = 74;

    const parts = Array.from(shell.children).filter(
      (el): el is HTMLElement => el.tagName === "SECTION" || el.tagName === "FOOTER",
    );

    let startX = 0;
    let startY = 0;
    let active = false;
    let pulling = false;
    let decided = false;
    let ready = false;
    let loading = false;
    let armed = false;
    let mode: "top" | "bottom" = "top";
    let resetTimer = 0;
    let reloadTimer = 0;

    const damp = (dy: number, max: number) => max * (1 - Math.exp(-dy / 190));
    const top = () => window.pageYOffset || document.documentElement.scrollTop || 0;
    const atBottom = () =>
      window.innerHeight + top() >= document.documentElement.scrollHeight - 2;

    function setGlow(el: HTMLElement, p: string, y: string) {
      el.style.setProperty("--pp", p);
      el.style.setProperty("--pull-y", y);
    }

    function setPull(d: number, dir: "top" | "bottom") {
      const p = Math.min(1, d / THRESHOLD).toFixed(3);
      const y = `${d.toFixed(1)}px`;
      const signed = dir === "top" ? d : -d;
      const t = d > 0 ? `translate3d(0, ${signed.toFixed(1)}px, 0)` : "";

      parts.forEach((el) => {
        el.style.transform = t;
      });

      if (dir === "top") {
        ptr!.style.setProperty("--ptr", p);
        ptr!.style.setProperty("--pull-y", y);
        setGlow(glowTop!, p, y);
        setGlow(glowBottom!, "0", "0px");
      } else {
        setGlow(glowBottom!, p, y);
        setGlow(glowTop!, "0", "0px");
      }
    }

    function setAnimating(on: boolean) {
      shell!.classList.toggle("ptr-animating", on);
      ptr!.classList.toggle("is-animating", on);
      glowTop!.classList.toggle("is-animating", on);
      glowBottom!.classList.toggle("is-animating", on);
    }

    // touchmove tinglovchisi faqat sahifa tepasida yoki pastida turganda ulanadi:
    // o'rtada oddiy scroll hech qachon to'xtatilmaydi (qotish yo'q)
    function arm() {
      const want = !loading && (active || top() <= 1 || atBottom());
      if (want && !armed) {
        document.addEventListener("touchmove", onMove, { passive: false });
        armed = true;
      } else if (!want && armed) {
        document.removeEventListener("touchmove", onMove);
        armed = false;
      }
    }

    function onStart(e: TouchEvent) {
      if (loading || e.touches.length !== 1) return;
      if (top() > 0 && !atBottom()) return;
      if (document.querySelector(".mobile-panel.is-open")) return;
      if (document.querySelector(".detail-overlay")) return;

      window.clearTimeout(resetTimer);
      setAnimating(false);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      active = true;
      decided = false;
      pulling = false;
      ready = false;
      arm();
    }

    function onMove(e: TouchEvent) {
      if (!active) return;

      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!decided) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        decided = true;

        const vertical = Math.abs(dy) > Math.abs(dx);
        if (vertical && dy > 0 && top() <= 0) {
          mode = "top";
          pulling = true;
        } else if (vertical && dy < 0 && atBottom()) {
          mode = "bottom";
          pulling = true;
        }

        if (!pulling) {
          active = false;
          arm();
          return;
        }
        shell!.classList.add("ptr-active");
      }

      if (!pulling) return;
      if (e.cancelable) e.preventDefault();

      const raw = mode === "top" ? dy : -dy;
      const d = raw > 0 ? damp(raw, mode === "top" ? MAX : MAX * 0.7) : 0;
      setPull(d, mode);

      const nowReady = d >= THRESHOLD;
      if (nowReady !== ready) {
        ready = nowReady;
        if (mode === "top") ptr!.classList.toggle("is-ready", ready);
        if (ready && navigator.vibrate) {
          try {
            navigator.vibrate(10);
          } catch {}
        }
      }
    }

    function onEnd() {
      if (!active) return;
      active = false;
      const wasPulling = pulling;
      pulling = false;
      if (!wasPulling) {
        arm();
        return;
      }

      setAnimating(true);

      if (mode === "top" && ready) {
        loading = true;
        ptr!.classList.add("is-loading");
        setPull(HOLD, "top");
        reloadTimer = window.setTimeout(() => window.location.reload(), 1100);
      } else {
        setPull(0, mode);
        ptr!.classList.remove("is-ready");
        resetTimer = window.setTimeout(() => {
          setAnimating(false);
          shell!.classList.remove("ptr-active");
          parts.forEach((el) => {
            el.style.transform = "";
          });
          arm();
        }, 650);
      }
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    window.addEventListener("scroll", arm, { passive: true });
    arm();

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("touchmove", onMove);
      window.removeEventListener("scroll", arm);
      window.clearTimeout(resetTimer);
      window.clearTimeout(reloadTimer);
      parts.forEach((el) => {
        el.style.transform = "";
      });
    };
  }, []);

  // Til almashtirish: sahifa qayta yuklanmaydi, tanlov cookie'da saqlanadi (keyingi kirishda ham shu til)
  function changeLang(next: Lang) {
    if (next === lang) return;
    setLang(next);
    document.documentElement.lang = next;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function handleAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const doctor = doctors.find((item) => item.id === selectedDoctor);

    if (!doctor) {
      alert(t.contact.chooseFirst);
      return;
    }

    window.open(doctor.telegram, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="site-shell">
      {/* Sayt ochilganda chiqadigan kirish animatsiyasi */}
      <div className="intro" aria-hidden="true">
        <div className="intro-core">
          <svg viewBox="0 0 120 120" className="intro-ring">
            <circle cx="60" cy="60" r="52" />
          </svg>
          <span className="intro-heart">♥</span>
        </div>
        <div className="intro-name">
          {"NeyroCardio".split("").map((char, index) => (
            <span key={index} style={{ "--i": index } as React.CSSProperties}>
              {char}
            </span>
          ))}
        </div>
      </div>

      {/* Fon: suzib yuruvchi yumshoq ranglar (shisha ularni xiralashtiradi) */}
      <div className="mesh" aria-hidden="true">
        <i className="blob blob-1" />
        <i className="blob blob-2" />
        <i className="blob blob-3" />
      </div>

      {/* Scroll chizig'i (telefonda) */}
      <div className="scroll-bar" ref={progressRef} aria-hidden="true" />

      {/* Tepadan tortganda chiqadigan yangilash belgisi */}
      <div className="ptr-glow" aria-hidden="true" />
      <div className="ptr-glow ptr-glow-b" aria-hidden="true" />
      <div className="ptr" aria-hidden="true">
        <svg viewBox="0 0 56 56" className="ptr-ring">
          <circle className="ptr-track" cx="28" cy="28" r="22" />
          <circle className="ptr-arc" cx="28" cy="28" r="22" />
        </svg>
        <span className="ptr-heart">♥</span>
      </div>

      {/* ============ NAV ============ */}
      <header className="nav-area" ref={navRef}>
        <nav className="nav glass">
          <a href="#bosh" className="brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-heart">♥</span>
            NeyroCardio
          </a>

          <div className="nav-links">
            <span className="nav-lens" aria-hidden="true" />
            {menuLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="nav-actions">
            <div className="lang-switch" role="group" aria-label={t.nav.lang} data-lang={lang}>
              <span className="lang-thumb" aria-hidden="true" />
              {(["uz", "ru"] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={lang === code}
                  onClick={() => changeLang(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            <a className="nav-cta" href="#qabul">
              {t.nav.cta}
            </a>

            <button
              type="button"
              className="theme-toggle"
              aria-label={t.nav.theme}
              suppressHydrationWarning
            >
              <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>

            <button
              type="button"
              className="menu-button"
              aria-label={menuOpen ? t.nav.menuClose : t.nav.menuOpen}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span className={`bars ${menuOpen ? "is-open" : ""}`}>
                <i />
                <i />
              </span>
            </button>
          </div>
        </nav>

        <div className={`mobile-panel glass ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
          {menuLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
              <span>↗</span>
            </a>
          ))}
          <a
            className="panel-cta"
            href="#qabul"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
          >
            {t.nav.cta}
          </a>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section id="bosh" className="hero">
        {/* Fon ranglari (doktorga qarab o'zgaradi) */}
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-tint tint-neyro" />
          <div className="hero-tint tint-cardio" />
          <div className="hero-ring ring-a" />
          <div className="hero-ring ring-b" />
        </div>

        {/* Fondagi doktorlar */}
        <div className={`hero-stage${heroDoctors.length < 2 ? " is-single" : ""}`}>
          {heroDoctors.map((doctor, index) => (
            <div
              key={doctor.id}
              className="stage-slide"
              style={{ "--i": index } as React.CSSProperties}
            >
              {doctor.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doctor.image} alt={doctorText(doctor, "name", lang)} draggable={false} />
              ) : null}
            </div>
          ))}

          <span className="float-chip chip-a glass">
            <Icon name="brain" /> {t.hero.chipNeuro}
          </span>
          <span className="float-chip chip-b glass">
            <Icon name="heart" /> {t.hero.chipCardio}
          </span>

          <div className="doctor-pill glass">
            <span className="live-dot" />
            <div className="pill-texts">
              {heroDoctors.map((doctor, index) => (
                <div
                  key={doctor.id}
                  className="pill-text"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <strong>{doctorText(doctor, "name", lang)}</strong>
                  <span>{doctorText(doctor, "role", lang)}</span>
                </div>
              ))}
            </div>
            <div className="pill-dots" aria-hidden="true">
              {heroDoctors.map((doctor, index) => (
                <span
                  key={doctor.id}
                  className="pill-dot"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <span />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-card glass" data-glow>
            <span className="eyebrow">
              <i /> {t.hero.eyebrow}
            </span>

            <h1 lang={lang}>
              {t.hero.title1}
              <span>{t.hero.title2}</span>
              {t.hero.title3}
            </h1>

            <p>{t.hero.text}</p>

            <div className="hero-actions">
              <a className="btn btn-primary" href="#qabul">
                {t.hero.cta} <span>↗</span>
              </a>
              <a className="btn btn-glass" href="#videolar">
                <span>▶</span> {t.hero.videos}
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong data-count="100" data-suffix="+">100+</strong>
                <span>{t.hero.stat1}</span>
              </div>
              <div>
                <strong data-count={doctors.length}>{doctors.length}</strong>
                <span>{t.hero.stat2}</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>{t.hero.stat3}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ISHONCH QATORI ============ */}
      <section className="trust" aria-label="NeyroCardio">
        <div className="container">
          <ul className="trust-row glass reveal">
            {t.trust.map((item, index) => (
              <li key={index}>
                <span className="trust-icon">
                  <Icon name={trustIcons[index]} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ DIRECTIONS ============ */}
      <section id="yonalishlar" className="section">
        <div className="container">
          <div className="heading reveal">
            <span className="tag">
              <b className="tag-num">01</b> {t.directions.tag}
            </span>
            <h2>{t.directions.title}</h2>
            <p>{t.directions.text}</p>
          </div>

          <div className="direction-grid">
            {t.directions.items.map((item, index) => (
              <article
                key={index}
                className="direction-card glass reveal"
                data-glow
                style={{ "--d": `${index * 90}ms` } as React.CSSProperties}
              >
                <div className="direction-icon">
                  <Icon name={directionIcons[index]} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <a href="#videolar">
                  {t.directions.more} <span>↗</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DOCTORS ============ */}
      <section id="shifokorlar" className="section">
        <div className="container">
          <div className="heading reveal">
            <span className="tag">
              <b className="tag-num">02</b> {t.doctors.tag}
            </span>
            <h2>{t.doctors.title}</h2>
            <p>{t.doctors.text}</p>
          </div>

          <div className="doctor-grid">
            {doctors.map((doctor, index) => (
              <article
                key={doctor.id}
                className={`doctor-card reveal tone-${doctor.accent}`}
                style={{ "--d": `${index * 120}ms` } as React.CSSProperties}
              >
                <div className="doctor-photo">
                  {doctor.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={doctor.image} alt={doctorText(doctor, "name", lang)} loading="lazy" />
                  ) : (
                    <span className="photo-fallback">
                      {doctor.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("")}
                    </span>
                  )}
                </div>

                <div className="doctor-info glass" data-glow>
                  <span className="doctor-role">{doctorText(doctor, "role", lang)}</span>
                  <h3>{doctorText(doctor, "name", lang)}</h3>
                  <p>{doctorText(doctor, "description", lang)}</p>
                  <div className="doctor-actions">
                    <a
                      className="btn btn-primary"
                      href={doctor.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Telegram ↗
                    </a>
                    <a className="phone-link" href={`tel:${doctor.phone}`}>
                      ☎ {t.doctors.call}
                    </a>
                    <button
                      type="button"
                      className="btn btn-glass"
                      aria-haspopup="dialog"
                      onClick={() => setDetail(doctor)}
                    >
                      {t.doctors.more}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ VIDEOS ============ */}
      <section id="videolar" className="section section-videos">
        <div className="container">
          <div className="heading reveal">
            <span className="tag">
              <b className="tag-num">03</b> {t.videos.tag}
            </span>
            <h2>{t.videos.title}</h2>
            <p>{t.videos.text}</p>
          </div>
        </div>

        <div className="video-grid">
          {videos.map((video, index) => {
            const params = new URLSearchParams({ rel: "0" });
            if (video.start) params.set("start", String(video.start));

            return (
              <article
                key={video.id}
                className="video-card glass reveal"
                style={{ "--d": `${index * 100}ms` } as React.CSSProperties}
              >
                <div className="video-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`}
                    title={videoTitle(video, lang)}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <div className="video-info">
                  <span>{t.videos.label}</span>
                  <h3>{videoTitle(video, lang)}</h3>
                </div>
              </article>
            );
          })}
        </div>

        <div className="container">
          <div className="channel-link reveal">
            <a
              className="btn btn-glass"
              href="https://www.youtube.com/@Neurocardiouz"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.videos.channel} ↗
            </a>
          </div>
        </div>
      </section>

      {/* ============ APPOINTMENT ============ */}
      <section id="qabul" className="section">
        <div className="container appointment-layout">
          <div className="appointment-copy reveal">
            <span className="tag">
              <b className="tag-num">04</b> {t.contact.tag}
            </span>
            <h2>{t.contact.title}</h2>
            <p>{t.contact.text}</p>
            <ul className="appointment-points">
              {t.contact.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <form className="appointment-form glass reveal" onSubmit={handleAppointment} data-glow>
            <label htmlFor="patient-name">{t.contact.name}</label>
            <input
              id="patient-name"
              name="name"
              type="text"
              placeholder={t.contact.namePh}
              autoComplete="name"
              required
            />

            <label htmlFor="patient-phone">{t.contact.phone}</label>
            <input
              id="patient-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="+998 __ ___ __ __"
              autoComplete="tel"
              required
            />

            <label htmlFor="doctor-select">{t.contact.doctor}</label>
            <select
              id="doctor-select"
              value={selectedDoctor}
              onChange={(event) => setSelectedDoctor(event.target.value)}
              required
            >
              <option value="">{t.contact.doctor}</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctorText(doctor, "name", lang)} — {doctorText(doctor, "role", lang)}
                </option>
              ))}
            </select>

            <button className="btn btn-primary form-submit" type="submit">
              {t.contact.submit} <span>↗</span>
            </button>

            <p className="form-note">{t.contact.note}</p>
          </form>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="footer-wrap">
        <div className="site-footer footer-rich glass">
          <div className="footer-brand">
            <a href="#bosh" className="brand">
              <span className="brand-heart">♥</span>
              NeyroCardio
            </a>
            <p>{t.footer.tagline}</p>
          </div>

          <nav className="footer-col" aria-label={t.footer.sections}>
            <h4>{t.footer.sections}</h4>
            {menuLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="footer-col">
            <h4>{t.footer.doctors}</h4>
            {doctors.map((doctor) => (
              <a key={doctor.id} href={doctor.telegram} target="_blank" rel="noopener noreferrer">
                {doctorText(doctor, "name", lang)}
                <small>{doctorText(doctor, "role", lang)}</small>
              </a>
            ))}
          </div>

          <div className="footer-col">
            <h4>{t.footer.follow}</h4>
            <a
              className="footer-social"
              href="https://www.youtube.com/@Neurocardiouz"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="youtube" /> YouTube ↗
            </a>
          </div>
        </div>

        <p className="footer-disclaimer">{t.footer.disclaimer}</p>
        <div className="footer-bottom">
          © {year} NeyroCardio.uz · {t.footer.rights}
        </div>
      </footer>

      <DoctorModal doctor={detail} lang={lang} onClose={() => setDetail(null)} />

      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
    </main>
  );
}
