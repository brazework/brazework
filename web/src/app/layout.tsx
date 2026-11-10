import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });


export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Forge: verified work, not résumés", template: "%s · Forge" },
  description:
    "Forge is the network for STEM organizations and the people who hire from them. Organizations run on it, members prove what they've built, and Ember, the AI agent built in, does the busywork.",
  applicationName: "Forge",
  // Installed from Safari's Share menu: full screen; the status bar takes the theme-color (ThemeChrome).
  appleWebApp: { capable: true, title: "Forge", statusBarStyle: "default" },
  icons: { apple: [{ url: "/app-icon/180", sizes: "180x180" }] },
  openGraph: {
    title: "Forge: verified work, not résumés",
    description: "The network for STEM organizations and the people who hire from them. Verified work, not résumés, and an AI agent that does the busywork.",
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
