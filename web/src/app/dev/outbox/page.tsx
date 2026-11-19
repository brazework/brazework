import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { outboxFile, outboxOn, type Email } from "@/lib/email";

export const metadata: Metadata = { title: "Local outbox", robots: { index: false } };

// The emails Brazework "sent" on the private local database (lib/email.ts localOutbox), newest first,
// so a demo can open a signature link on camera. 404 everywhere else: it needs BRAZEWORK_LOCAL_OUTBOX=1
// and a localhost Supabase, which production never has.
export default function OutboxPage() {
  // Checked here, before anything renders, so it's a real 404 everywhere the outbox is off. Inside the
  // streamed part below, notFound() came after the page had already started as a 200 (production
  // showed an empty "Local outbox" heading, with nothing in it).
  if (!outboxOn()) notFound();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Local outbox</h1>
      <p className="mt-1 text-sm text-muted">Emails from this local demo. Nothing here was really sent.</p>
      <Suspense fallback={<div className="mt-6 h-40 shimmer rounded-2xl" aria-busy="true" />}><Outbox /></Suspense>
    </main>
  );
}

type Sent = Email & { id: string; at: string };
const LINK = /https?:\/\/[^\s<>"')]+/g;

async function Outbox() {
  await connection();
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(outboxFile(), "utf8").catch(() => "");
  const mail = raw.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) as Sent; } catch { return null; } })
    .filter((m): m is Sent => Boolean(m)).reverse().slice(0, 50);
  if (!mail.length) return <p className="mt-6 rounded-2xl border border-line p-5 text-sm text-muted">Nothing yet. Ask someone to sign a milestone, and the email shows up here.</p>;
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {mail.map((m) => (
        <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-faint">To {m.to} · {new Date(m.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="mt-1 font-medium">{m.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-2">{m.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Set(m.text.match(LINK) ?? [])].map((u) => <a key={u} href={u} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2">Open {new URL(u).pathname}</a>)}
          </div>
        </li>
      ))}
    </ul>
  );
}
