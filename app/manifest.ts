
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NeuroCardio",
    short_name: "NeuroCardio",
    description:
      "Nevrologiya, kardiologiya va umumiy salomatlik haqida ishonchli ma’lumotlar.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
