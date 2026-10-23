"use client";

// Sayt Telegram Mini App ichida ochilganda: ilovani to'liq ochadi, rangni Telegram'ga moslaydi,
// havolalarni Telegram usulida ochadi. Oddiy brauzerda hech narsa qilmaydi.
import { useEffect } from "react";
import { whenTelegram, type TgWebApp } from "./lib/tg-client";

const BG = { light: "#eceff3", dark: "#08090c" } as const;

export default function TelegramBridge() {
  useEffect(() => {
    let wa: TgWebApp | null = null;
    const root = document.documentElement;

    // Rang: sayt rejimiga mos (foydalanuvchi sayt ichida rejimni almashtirsa ham)
    const paint = () => {
      if (!wa) return;
      const theme = root.dataset.theme === "dark" ? "dark" : "light";
      try {
        wa.setHeaderColor(BG[theme]);
        wa.setBackgroundColor(BG[theme]);
        wa.setBottomBarColor?.(BG[theme]);
      } catch {}
    };

    const onTheme = () => {
      if (!wa) return;
      root.dataset.theme = wa.colorScheme;
      paint();
    };

    // Havolalar: t.me — Telegram ichida, boshqa saytlar — tashqi brauzerda, tel: — raqamni nusxalash
    const onClick = (event: MouseEvent) => {
      if (!wa || event.defaultPrevented || event.button !== 0) return;
      const a = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";

      if (href.startsWith("tel:")) {
        event.preventDefault();
        const number = href.slice(4);
        const done = () => wa?.showAlert(`${number}\n\n${root.lang === "ru" ? "Номер скопирован." : "Raqam nusxalandi."}`);
        navigator.clipboard?.writeText(number).then(done, done) ?? done();
        return;
      }
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin === location.origin) return;
      event.preventDefault();
      if (url.hostname === "t.me") wa.openTelegramLink(url.toString());
      else wa.openLink(url.toString());
    };

    const themeObserver = new MutationObserver(paint);

    const stop = whenTelegram((app) => {
      wa = app;
      try {
        app.ready();
        app.expand();
        // Pastga surganda ilova tasodifan yopilmasin
        if (app.isVersionAtLeast("7.7")) app.disableVerticalSwipes?.();
      } catch {}

      // Birinchi kirishda Telegram rejimi, keyin foydalanuvchi tanlovi saqlanadi
      let saved = "";
      try {
        saved = sessionStorage.getItem("nc_tg_theme") ?? "";
      } catch {}
      if (!saved) {
        root.dataset.theme = app.colorScheme;
        try {
          sessionStorage.setItem("nc_tg_theme", "1");
        } catch {}
      }
      paint();
      app.onEvent("themeChanged", onTheme);
      themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      document.addEventListener("click", onClick, true);
    });

    return () => {
      stop();
      wa?.offEvent("themeChanged", onTheme);
      themeObserver.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
