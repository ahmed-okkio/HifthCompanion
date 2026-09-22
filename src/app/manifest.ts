import type { MetadataRoute } from "next";

// M4-1: Web app manifest (App Router convention). Next auto-links this at
// /manifest.webmanifest. Colors mirror globals.css design tokens:
//   theme = --surface-main (#FFFFFF, matches the top nav bar),
//   background = --surface-app (#F7F8FA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HifthCompanion",
    short_name: "HifthCompanion",
    description:
      "Read, annotate, and study the Quran with powerful drawing tools and shareable annotations.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F8FA",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
