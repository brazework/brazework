import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/landing/closing";
import { H2 } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { Logo } from "@/components/ui";
import { ASSISTANTS, COMMANDS, FIELDS, FLOW, FOR_EVERYONE, RULES, toolGroups } from "@/lib/ai-guide";
import { ConnectSlot } from "@/components/connect/connect-live";
import { LaneMoments } from "@/components/playbooks/lane-moments";

export const metadata: Metadata = {
  title: "Connect your AI",
  description: "Connect Claude, Cursor, VS Code and other AI assistants to Brazework. Your AI drafts the record of what you built from the tools you already use, you approve it, and someone who saw the work signs it. Guides for 20 fields.",
  alternates: { canonical: "/ai" },
};

// /ai: the public guide to connecting your AI (docs/mcp-workflows.md has the long version). Readable
// signed out and by search engines, so a visitor can see what it does before signing up. Everything on
// it comes from the code's own lists (lib/ai-guide.ts): a tool or prompt the server gains shows up here.
// Static, apart from one small part that says whether one-click sign-in is switched on yet.
export default function AiGuidePage() {
  return (
    <div className="landing min-h-dvh">
      <ThemeChrome landing />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 text-muted hover:text-text">Log in</Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 font-medium text-on-accent hover:opacity-90">Sign up free</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-6 sm:pt-16">
        <h1 className={H2}>Your AI fills in your record.<br className="hidden sm:block" /> People who saw it sign it.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">Connect Claude or the assistant you already use. Ask in plain words, like &ldquo;put the analysis I finished on my record&rdquo;, and it drafts the result with its proof from your tools. You approve it, and someone who saw the work signs it.</p>

        <ol aria-label="How it works" className="mt-12 grid gap-px overflow-hidden rounded-[1.25rem] border border-line bg-line md:grid-cols-3">
          {FLOW.map((f, i) => (
            <li key={f.title} className="bg-surface p-6">
              <p className="text-sm text-faint">Step {i + 1}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="setup" className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="setup" className="text-2xl font-semibold tracking-tight">Set it up in two minutes</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">Brazework is an MCP server, the open standard AI assistants use to connect to apps. It works with {ASSISTANTS.slice(0, -1).join(", ")} and {ASSISTANTS.at(-1)}, and with Claude on the web and desktop.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <ConnectSlot />
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-semibold">Or with a token</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">In Brazework, open Settings → Your tools and pick your assistant. Brazework makes a token and gives you the exact command or link to add it, filled in. You choose whether it can post for you or only leave drafts, and you can revoke it at any time.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="commands" className="mt-20">
          <h2 id="commands" className="text-2xl font-semibold tracking-tight">What to ask</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">Plain words work. These commands run the common ones step by step; in Claude, type <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-sans text-sm">/</kbd> to see them.</p>
          <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {COMMANDS.map((c) => (
              <div key={c.name} className="border-t border-line pt-4">
                <dt className="font-medium">{c.title} <code className="ml-1 text-sm text-faint">/{c.name}</code></dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-muted">{c.body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            {toolGroups().map((g) => (
              <div key={g.id}>
                <h3 className="font-semibold">{g.title}</h3>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {g.tools.map((t) => (
                    <li key={t.name} className="py-3 text-[15px]">
                      <span className="font-medium">{t.title}</span> <code className="text-sm text-faint">{t.name}</code>
                      <span className="mt-0.5 block leading-relaxed text-muted">{t.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="never" className="mt-20 max-w-3xl">
          <h2 id="never" className="text-2xl font-semibold tracking-tight">What it never does</h2>
          <ul className="mt-5 flex flex-col gap-3 text-[15px] leading-relaxed text-text-2">
            {RULES.map((r) => <li key={r} className="border-l-2 border-ok pl-4">{r}</li>)}
          </ul>
        </section>

        <section aria-labelledby="fields" className="mt-20">
          <h2 id="fields" className="text-2xl font-semibold tracking-tight">Your field</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">For each field: the tools people in it use and how your assistant reaches them, the moments worth recording, and who signs them, when you&apos;re studying and when you&apos;re working. Pick yours.</p>
          <nav aria-label="Fields" className="mt-6 flex flex-wrap gap-2">
            {FIELDS.map((f) => <a key={f.id} href={`#${f.id}`} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm text-text-2 hover:border-line-strong">{f.field}</a>)}
          </nav>
          <div className="mt-10 flex flex-col gap-12">
            {FIELDS.map((f) => (
              <section key={f.id} id={f.id} aria-labelledby={`${f.id}-h`} className="scroll-mt-24 border-t border-line pt-8">
                <h3 id={`${f.id}-h`} className="text-xl font-semibold tracking-tight">{f.field}</h3>
                <div className="mt-5 grid gap-8 lg:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-faint">Tools your assistant can reach</h4>
                    <ul className="mt-2 flex flex-col gap-2 text-[15px]">
                      {f.tools.map((t) => <li key={t.name}><span className="font-medium">{t.name}</span> <span className="text-sm text-faint">{t.how}</span><span className="block text-muted">{t.reads}</span></li>)}
                    </ul>
                  </div>
                  <LaneMoments lanes={f.lanes} />
                </div>
              </section>
            ))}
          </div>
          <p className="mt-12 max-w-3xl text-[15px] leading-relaxed text-muted">In every field: {FOR_EVERYONE.map((t) => `${t.name} (${t.how.toLowerCase()})`).join(", ")}. Each tool is marked by who runs its server: the vendor (official), someone else (community: read it before you install it), or none, where your assistant reads the files you point it to.</p>
        </section>

        <section className="mt-20 rounded-[1.25rem] border border-line bg-surface p-8 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">Start your record</h2>
          <p className="mt-2 max-w-xl text-[15px] text-muted">It&apos;s free. Make an account, connect your assistant from Settings → Your tools, and ask it to get you started.</p>
          <Link href="/signup" className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90">Sign up free</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

