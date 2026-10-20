import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Telefondan (bir xil Wi-Fi tarmog'ida) localhost'ni ochganda dev rejimi skriptlari ishlashi uchun.
  // Faqat "npm run dev" uchun; Netlify'dagi saytga ta'sir qilmaydi.
  allowedDevOrigins: ["192.168.1.10", "192.168.*.*", "10.*.*.*"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
