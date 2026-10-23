// Saytdan Telegram botga kirish havolalari
export const BOT_USERNAME = "neyrocardio_bot";
export const botLink = (start?: string) =>
  `https://t.me/${BOT_USERNAME}${start ? `?start=${encodeURIComponent(start)}` : ""}`;
