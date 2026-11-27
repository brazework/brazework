import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { env } from "@/lib/env";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });


export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Brazework: build it, prove it, own it", template: "%s · Brazework" },
  description:
    "Brazework is a record of the work you've really done, each piece signed by the person who saw it: your professor, your club or your coworker. Free for students and professionals; schools run their project courses on it.",
  applicationName: "Brazework",
  // Installed from Safari's Share menu: full screen; the status bar takes the theme-color (ThemeChrome).
  appleWebApp: { capable: true, title: "Brazework", statusBarStyle: "default" },
  openGraph: {
    title: "Brazework: build it, prove it, own it",
    description: "A record of the work you've really done, each piece signed by the person who saw it: your professor, your club or your coworker. Free for students and professionals; schools run their project courses on it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Draw under the notch and the home indicator; the app pads itself with the safe-area insets.
  viewportFit: "cover",
  // Light until the member picks dark (ThemeChrome repaints it to match the theme in effect).
  themeColor: "#f7f7f5",
};

// Runs before first paint so a saved theme never flashes the other one. Brazework has one theme in
// light and dark (redesign 2026-11); an old colour skin saved on this device is dropped here. Every
// screen starts light (Josh, 2026-11-27), whatever the device is set to, until the member picks a
// theme: Light or Dark (the toggle or Settings), or System in Settings, saved as "system", which
// leaves html[data-theme] off so the device's setting decides (globals.css).
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("forge-theme");if(t!=="system")d.dataset.theme=t==="dark"?"dark":"light";localStorage.removeItem("forge-skin")}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        {/* /_vercel/insights only exists on Vercel; off it (CI, next start) the script 404s and trips the CSP check. */}
        {process.env.VERCEL_ENV && <Analytics />}
      </body>
    </html>
  );
}
