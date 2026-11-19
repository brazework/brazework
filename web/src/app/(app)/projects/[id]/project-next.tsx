import { ArrowRight, BadgeCheck, Clock, Flag, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { CopyLink } from "@/components/app/copy-link";
import { NextStrip, nextButtonCls } from "@/components/app/next-strip";
import type { NextStep } from "@/lib/next-step";

// A project's Next strip (lib/next-step.ts decides the step; components/app/next-strip.tsx draws it):
// one sentence and one button under the cover, so the page says what to do instead of showing
// everything at once. `add`: the inline "Add milestone" control (it opens on this page). `message`: who
// to ask, when we know an officer who can sign (their id and name). With a goal the sentence is a step
// toward it; without one, a quiet "Set a goal" link.
export function ProjectNext({ step, add, message, shared }: { step: NextStep; add: React.ReactNode; message?: { id: string; name: string } | null; shared?: boolean }) {
  const aside = !step.toward && <Link href="/profile#goal" className="inline-flex items-center gap-1 text-xs text-faint transition hover:text-text"><Target className="size-3.5" /> Set a goal</Link>;
  const strip = (icon: React.ReactNode, text: React.ReactNode, action: React.ReactNode) => <NextStrip icon={icon} toward={step.toward} action={action} aside={aside}>{text}</NextStrip>;
  const lead = (s: string) => (step.toward ? s[0].toLowerCase() + s.slice(1) : s);
  switch (step.kind) {
    case "ask_sign": {
      const who = message?.name ?? step.signers[0];
      return strip(<Clock />,
        step.toward && who ? <>ask {who} to sign <b className="font-medium text-text">{step.title}</b>. It&apos;s waiting for {step.who}.</>
          : <><b className="font-medium text-text">{step.title}</b> is waiting for {step.who}.{step.signers.length > 0 && <> {step.signers.slice(0, 2).join(" or ")} can sign it.</>}</>,
        message ? <Link href={`/messages/new?to=${message.id}`} className={nextButtonCls}>Ask {message.name} <ArrowRight className="size-3.5" /></Link> : <a href="#milestones" className={nextButtonCls}>See it <ArrowRight className="size-3.5" /></a>);
    }
    case "first_milestone":
      return strip(<Flag />, <>{lead("Log your first milestone: a test that passed, a part that works, a result. Someone who saw it signs it.")}</>, add);
    case "log_milestone":
      return strip(<Flag />, <>{lead("Log your next result here as a milestone, and ask someone who saw it to sign it.")}</>, add);
    case "send_draft":
      return strip(<Sparkles />, <>{lead("A draft is waiting for this project: ")}<b className="font-medium text-text">{step.title}</b>.</>, <a href="#drafts" className={nextButtonCls}>Review and send <ArrowRight className="size-3.5" /></a>);
    case "share_signed":
      return strip(<BadgeCheck className="text-ok" />, <><b className="font-medium text-text">{step.title}</b> is signed. Share the card: it shows who signed it.</>,
        shared ? <CopyLink path={`/p/${step.milestoneId}`} label="Copy the card's link" /> : <a href="#milestones" className={nextButtonCls}>Share it <ArrowRight className="size-3.5" /></a>);
  }
}
