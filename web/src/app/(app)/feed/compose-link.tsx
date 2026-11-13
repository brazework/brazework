"use client";
import Link from "next/link";

// A link on Today that leads to the log-work box. The box is on this same page, and a hash change
// alone doesn't open it (see composer.tsx), so the link also sends "forge:compose", the way the
// sidebar's Log work button does. Links elsewhere behave as plain links.
export function ComposeLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const toBox = href.startsWith("/feed") && href.endsWith("#composer");
  return (
    <Link href={href} className={className}
      onClick={(e) => {
        if (!toBox) return;
        // Already here with nothing else to load: just open the box. With a project in the link, let
        // the page load it first, then open the box.
        if (href === "/feed#composer") e.preventDefault();
        window.dispatchEvent(new Event("forge:compose"));
      }}>
      {children}
    </Link>
  );
}
