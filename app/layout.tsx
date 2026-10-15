
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuroCardio",
  description:
    "Nevrologiya, kardiologiya va umumiy salomatlik haqida shifokorlar tayyorlagan ishonchli ma’lumotlar.",
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
            __html: `try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;if(sessionStorage.getItem("nc_intro"))document.documentElement.classList.add("no-intro")}catch(e){}`,
          }}
        />
      </head>

      <body className="min-h-full flex flex-col">
        {children}

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
