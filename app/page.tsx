import { Suspense } from "react";
import { connection } from "next/server";
import HomeClient from "./home-client";
import { readData } from "./lib/store";

// Ma'lumotlar har so'rovda yangidan o'qiladi, shuning uchun admin paneldagi o'zgarishlar darhol ko'rinadi.
// (Next 16 cacheComponents bilan `export const dynamic` ishlamaydi, o'rniga connection() ishlatiladi.)
async function Content() {
  await connection();
  const { doctors, videos } = await readData();
  return <HomeClient doctors={doctors} videos={videos} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
