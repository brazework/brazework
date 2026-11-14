import { Inbox, MailCheck, MessageSquareText, Search, ShieldCheck, Signature } from "lucide-react";
import Link from "next/link";
import { SearchMock, VouchMock } from "./angles-client";
import { Head } from "./marketing";

// Two sections that close the loop (Linear FIX-92, FIX-94): proof for builders without a club, and
// the other side of the network, the labs and companies searching for exactly that work.

function Steps({ items }: { items: [typeof Inbox, string, string][] }) {
  return (
    <ol className="m-hide mt-8 grid gap-5">
      {items.map(([Icon, t, b]) => (
        <li key={t} className="flex gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface"><Icon className="size-4" /></span>
          <span><span className="block font-medium">{t}</span><span className="mt-0.5 block text-sm leading-relaxed text-muted">{b}</span></span>
        </li>
      ))}
    </ol>
  );
}

export function NoClub() {
  return (
    <section id="noclub" data-story="No club?" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Head eyebrow="Without a club" title="No club?" accent="Get it vouched."
            body="Not everyone builds in a club. Ask the professor, TA, lab PI or manager who saw the work to vouch for it. It takes them a minute and no account." />
          <Steps items={[
            [MailCheck, "They get one email", "Sent to their university or company address, never Gmail, so their name means something."],
            [Signature, "They say what they saw", "In a sentence or two, and how they know your work. Or they decline, and nothing is added."],
            [ShieldCheck, "It's on your record", "With their name, role and domain, exactly like a club's sign-off."],
          ]} />
        </div>
        <VouchMock />
      </div>
    </section>
  );
}

export function OtherSide() {
  return (
    <section id="companies" data-story="For companies" className="story-sec scroll-mt-24 bg-surface-2/50 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <Head eyebrow="For companies" title="Search the work," accent="not the résumé."
            body="Find student engineers by what they built and who signed it, not by keywords on a résumé anyone can generate." />
          <Steps items={[
            [Search, "Search by the work", "A field, a tool, a spec: \"PCB bring-up\", \"CRISPR\", \"Lean 4\". Only signed work shows up."],
            [Inbox, "See who signed it", "Every result names the club officer or the person who saw it happen, and shows how steadily the builder ships."],
            [MessageSquareText, "Ask, and they decide", "Your message lands in their requests. Builders accept or decline, so the ones who reply want to talk."],
          ]} />
          {/* The two ways a company starts: sponsor a challenge clubs opt into, or see what it costs. */}
          <div className="m-hide mt-8 flex flex-wrap gap-3">
            <Link href="#founding" className="bg-accent-grad inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-on-accent transition hover:opacity-90">Sponsor a challenge</Link>
            <Link href="#pricing" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold transition hover:border-line-strong">See pricing</Link>
          </div>
        </div>
        <SearchMock />
      </div>
    </section>
  );
}
