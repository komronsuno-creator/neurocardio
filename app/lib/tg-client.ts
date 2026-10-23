// Telegram Mini App bilan ishlash (brauzerda). Sayt oddiy brauzerda ochilganda bularning hammasi jim o'tib ketadi.
// Telegram skripti faqat sayt Telegram ichida ochilganda yuklanadi (layout.tsx dagi kichik skript).

export type TgWebApp = {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; allows_write_to_pm?: boolean };
  };
  colorScheme: "light" | "dark";
  version: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  disableVerticalSwipes?: () => void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?: (color: string) => void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, cb?: () => void): void;
  requestWriteAccess?: (cb?: (granted: boolean) => void) => void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/** Sayt Telegram ichida ochilganmi (layout'dagi skript "in-tg" klassini qo'yadi). */
export const inTelegram = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("in-tg");

/** Telegram skripti yuklangach chaqiriladi. Telegram bo'lmasa hech qachon chaqirilmaydi. */
export function whenTelegram(cb: (wa: TgWebApp) => void): () => void {
  if (!inTelegram()) return () => undefined;
  let tries = 0;
  let timer = 0;
  let stopped = false;
  const check = () => {
    if (stopped) return;
    const wa = window.Telegram?.WebApp;
    if (wa && wa.initData) {
      cb(wa);
      return;
    }
    if (tries++ < 100) timer = window.setTimeout(check, 50);
  };
  check();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

export const getWebApp = (): TgWebApp | null =>
  inTelegram() && window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null;

/** Imzolangan foydalanuvchi ma'lumoti (serverda tekshiriladi). Telegram'dan tashqarida — bo'sh. */
export const tgInitData = () => getWebApp()?.initData ?? "";

export const tgUserName = () => {
  const u = getWebApp()?.initDataUnsafe.user;
  return u ? [u.first_name, u.last_name].filter(Boolean).join(" ").trim() : "";
};

/** Tashqi havolani to'g'ri ochish: Telegram ichida Telegram usulida, aks holda yangi oynada. */
export function openExternal(url: string) {
  const wa = getWebApp();
  if (wa) {
    if (/^https:\/\/t\.me\//i.test(url)) wa.openTelegramLink(url);
    else wa.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
