import type { MetadataRoute } from "next";
import { getSiteConfigSafe } from "@/lib/queries/config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfigSafe();
  const name = `${config.eventName} ${config.eventYear}`;
  return {
    name,
    short_name: config.eventName,
    description: "ตารางการแข่งขัน ผลการแข่งขัน และคะแนนรวมกีฬาสีโรงเรียน",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    // Matches the viewport themeColor in app/layout.tsx.
    theme_color: "#f5f5f5",
    lang: "th",
    // The uploaded logo first, as the tab icon uses it; the team-color tile stays as a fallback.
    icons: [
      ...(config.schoolLogoUrl ? [{ src: config.schoolLogoUrl, sizes: "any" }] : []),
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
