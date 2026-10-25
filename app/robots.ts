import type { MetadataRoute } from "next";

// Qidiruv tizimlari uchun: asosiy sahifa ochiq, admin/kabinet/API yopiq
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/doctor", "/api/"] }],
    sitemap: "https://neyrocardio.uz/sitemap.xml",
    host: "https://neyrocardio.uz",
  };
}
