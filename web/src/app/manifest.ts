import type { MetadataRoute } from "next";

// "Add to Home Screen": Brazework opens full screen like an app, straight to your feed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brazework",
    short_name: "Brazework",
    description: "Home base for university STEM clubs: build, prove it, get hired.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
