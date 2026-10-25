
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TelegramBridge from "./telegram-bridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE = "https://neyrocardio.uz";
const DESC =
  "NeyroCardio — nevrolog va kardiolog shifokorlar: bosh og‘rig‘i, asab kasalliklari, yurak og‘rig‘i, qon bosimi, aritmiya. Toshkentda qabulga yozilish, shifokorga onlayn savol berish. Невролог и кардиолог в Ташкенте.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "NeyroCardio — nevrolog va kardiolog Toshkentda | Невролог и кардиолог в Ташкенте",
    template: "%s | NeyroCardio",
  },
  description: DESC,
  applicationName: "NeyroCardio",
  keywords: [
    "nevrolog", "kardiolog", "nevrologiya", "kardiologiya", "neyrokardiologiya", "nevropatolog",
    "asab doktori", "asab kasalliklari", "yurak doktori", "yurak og‘rig‘i", "yurak og'rig'i",
    "bosh og‘rig‘i", "bosh aylanishi", "migren", "insult", "qon bosimi", "gipertoniya", "aritmiya",
    "yurak urishi", "EKG", "shifokor Toshkent", "Olmazor shifokor", "Real Medical", "qabulga yozilish",
    "невролог Ташкент", "кардиолог Ташкент", "неврология", "кардиология", "боль в сердце",
    "головная боль", "давление", "аритмия", "инсульт", "врач невропатолог", "запись к врачу Ташкент",
  ],
  alternates: {
    canonical: "/",
    languages: { "uz-UZ": "/", "ru-RU": "/", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "NeyroCardio",
    locale: "uz_UZ",
    alternateLocale: ["ru_RU"],
    title: "NeyroCardio — nevrolog va kardiolog Toshkentda",
    description: DESC,
    images: [{ url: "/doctor-2.png", alt: "NeyroCardio shifokorlari" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NeyroCardio — nevrolog va kardiolog Toshkentda",
    description: DESC,
    images: ["/doctor-2.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "medical",
  // Google Search Console tasdiq kodi Netlify'dagi GOOGLE_SITE_VERIFICATION o'zgaruvchisidan olinadi
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  other: {
    "geo.region": "UZ-TK",
    "geo.placename": "Tashkent",
    "geo.position": "41.351556;69.212944",
    ICBM: "41.351556, 69.212944",
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sahifa CSS yuklanishiga tayyor bo‘lguncha */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html:not(.nc-ready) body{visibility:hidden}html{background:#eceff3}html[data-theme="dark"]{background:#08090c}',
          }}
        />

        <noscript>
          <style>{`body{visibility:visible!important}`}</style>
        </noscript>

        {/* Sahifa tayyorligini tekshirish */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,n=0;function ready(){try{return getComputedStyle(d).getPropertyValue("--nc-ready").trim()==="1"}catch(e){return true}}function tick(){if(ready()||n++>70){d.classList.add("nc-ready");return}setTimeout(tick,50)}tick()})();`,
          }}
        />

        {/* Tungi rejim */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;if(sessionStorage.getItem("nc_intro"))document.documentElement.classList.add("no-intro");var l=document.cookie.match(/(?:^|; )lang=(uz|ru)/);if(l)document.documentElement.lang=l[1]}catch(e){}`,
          }}
        />

        {/* Telegram Mini App: sayt Telegram ichida ochilganda Telegram skriptini yuklaydi (oddiy brauzerda yuklanmaydi) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;if(/tgWebApp/.test(location.hash)||sessionStorage.getItem("nc_tg")){sessionStorage.setItem("nc_tg","1");d.classList.add("in-tg","no-intro");var s=document.createElement("script");s.src="https://telegram.org/js/telegram-web-app.js";document.head.appendChild(s)}}catch(e){}`,
          }}
        />
      </head>

      <body className="min-h-full flex flex-col">
        {children}
        <TelegramBridge />

        {/* Google AdSense */}
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2888644714622022"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
