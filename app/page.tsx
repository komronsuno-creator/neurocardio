import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import HomeClient from "./home-client";
import { buildJsonLd } from "./seo-jsonld";
import { readData } from "./lib/store";
import { LANG_COOKIE, isLang } from "./lib/i18n";

// Ma'lumotlar har so'rovda yangidan o'qiladi, shuning uchun admin paneldagi o'zgarishlar darhol ko'rinadi.
// (Next 16 cacheComponents bilan `export const dynamic` ishlamaydi, o'rniga connection() ishlatiladi.)
async function Content() {
  await connection();
  const [{ doctors, videos }, jar] = await Promise.all([readData(), cookies()]);
  const saved = jar.get(LANG_COOKIE)?.value;
  const jsonLd = JSON.stringify(buildJsonLd(doctors)).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeClient doctors={doctors} videos={videos} initialLang={isLang(saved) ? saved : "uz"} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
