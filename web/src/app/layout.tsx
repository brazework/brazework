import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });


export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Forge: where STEM clubs build, prove it and get hired", template: "%s · Forge" },
  description:
    "Forge is home base for university STEM clubs. Talk, plan and build together, and every result your club verifies becomes proof that gets you hired. Ember, your AI teammate, handles the busywork.",
  applicationName: "Forge",
  // Installed from Safari's Share menu: full screen, content under a see-through status bar.
  appleWebApp: { capable: true, title: "Forge", statusBarStyle: "black-translucent" },
  icons: { apple: [{ url: "/app-icon/180", sizes: "180x180" }] },
  openGraph: {
    title: "Forge: where STEM clubs build, prove it and get hired",
    description: "Your club's home base. Your verified work. Proof that beats a résumé.",
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
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("forge-theme"),k=localStorage.getItem("forge-skin");if(t==="light"||t==="dark")d.dataset.theme=t;if(k&&/^(blueprint|fire|aurora|emerald)$/.test(k))d.dataset.skin=k}catch(e){}`;

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
