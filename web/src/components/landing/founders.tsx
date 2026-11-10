import Image from "next/image";
import { Eyebrow, H2 } from "./marketing";

// Who built Brazework and why. Empty until the founders write it themselves: no invented bios. Add an
// entry per founder (photo in /public/founders/, optional), and the section appears.
type Founder = { name: string; role: string; photo?: string; bio: string; links: { label: string; href: string }[] };
export const FOUNDERS: Founder[] = [
  // { name: "", role: "Co-founder", photo: "/founders/name.jpg", bio: "", links: [{ label: "LinkedIn", href: "https://…" }] },
];

export function Founders() {
  const ready = FOUNDERS.filter((f) => f.name.trim() && f.bio.trim());
  if (!ready.length) return null;
  return (
    <section id="founders" data-story="Founders" className="story-sec scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Eyebrow>Founders</Eyebrow>
        <h2 className={`mt-5 ${H2}`}>Built by people <span className="text-grad">who build.</span></h2>
        <div className="m-cards mt-10 grid gap-4 md:grid-cols-2">
          {ready.map((f) => (
            <article key={f.name} className="rounded-3xl border border-line bg-surface p-6">
              <div className="flex items-center gap-4">
                {f.photo ? <Image src={f.photo} alt="" width={56} height={56} className="size-14 rounded-full object-cover" /> : <span className="bg-accent-grad grid size-14 place-items-center rounded-full text-lg font-semibold text-on-accent">{f.name[0]}</span>}
                <div><div className="font-semibold">{f.name}</div><div className="text-sm text-muted">{f.role}</div></div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-text-2">{f.bio}</p>
              {f.links.length > 0 && <div className="mt-4 flex gap-3 text-sm">{f.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="text-muted underline-offset-4 hover:text-text hover:underline">{l.label}</a>)}</div>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
