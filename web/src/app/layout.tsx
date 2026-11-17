import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });


export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Brazework: build it, prove it, get found", template: "%s · Brazework" },
  description:
    "Brazework is the record of your work, signed by the people who saw it. Log what you build, get it signed by a club officer, a manager or a mentor, and let companies find you by the proof.",
  applicationName: "Brazework",
  // Installed from Safari's Share menu: full screen; the status bar takes the theme-color (ThemeChrome).
  appleWebApp: { capable: true, title: "Brazework", statusBarStyle: "default" },
  openGraph: {
    title: "Brazework: build it, prove it, get found",
    description: "The record of your work, signed by the people who saw it: a club officer, a manager, a mentor. Companies find you by the proof, not the résumé.",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Draw under the notch and the home indicator; the app pads itself with the safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Runs before first paint so a saved theme never flashes the other one.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("forge-theme"),k=localStorage.getItem("forge-skin");if(t==="light"||t==="dark")d.dataset.theme=t;if(k&&/^(blueprint|fire|aurora|emerald)$/.test(k)&&location.pathname!=="/")d.dataset.skin=k}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
