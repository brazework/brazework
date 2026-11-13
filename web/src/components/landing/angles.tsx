import { Inbox, MailCheck, MessageSquareText, Search, ShieldCheck, Signature } from "lucide-react";
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
            body="Labs, startups, companies and grad programs search Brazework by what people built and who signed it, not by keywords on a résumé." />
          <Steps items={[
            [Search, "They search the work", "A field, a tool, a spec: \"PCB bring-up\", \"CRISPR\", \"Lean 4\". Only signed work counts."],
            [Inbox, "They see who vouched", "Every result shows the club or the person who signed it, and how steadily you build."],
            [MessageSquareText, "They ask, you decide", "Their message lands in your Requests. Accept, decline or block; you're never cold-called."],
          ]} />
        </div>
        <SearchMock />
      </div>
    </section>
  );
}
