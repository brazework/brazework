"use client";
import { ProofPicker } from "@/components/projects/proof-picker";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Building2, Camera, Check, Clock, Link2, Loader2, Mail, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { Button, Field, inputCls } from "@/components/ui";
import { BUILD_KEY, cleanBuild, guessField } from "@/lib/front-door";
import { TOPICS, cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { UploadError, uploadMedia } from "@/lib/upload";
import { RELATIONSHIPS } from "@/lib/vouch-email";
import { LINKEDIN_ADD_HERE, LINKEDIN_PLACEHOLDER, LINKEDIN_PRIVATE, LINKEDIN_WHY } from "@/lib/linkedin";
import { finishFirstBuild, type FirstBuildSigner } from "./actions";

// Build-first onboarding (the Product Hunt launch): after About you, the way in *is* the first
// milestone. What you built → its proof → who saw it, then your profile, with the milestone on it.
// Everything stays in this tab (sessionStorage) until Finish, which saves it all at once
// (finishFirstBuild in ./actions.ts): a milestone's proof can't be changed after it's saved.

export type WizardClub = { id: string; name: string; field: string; members: number; mine: boolean };
type Step = "build" | "proof" | "signer";
type Proof = "link" | "photo" | "later";
type Signer = "email" | "club" | "none";
type State = {
  step: Step; text: string; field: string; fieldTouched: boolean; achievedOn: string;
  proof: Proof; link: string; photo: string; signer: Signer; email: string; relationship: string; clubId: string; projectId?: string; linkedin: string;
};

const KEY = "brazework-first-build";
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const isLink = (s: string) => /^https:\/\/\S+\.\S+/i.test(s.trim()) && s.trim().length <= 300;

function initial(student: boolean): State {
  return { step: "build", text: "", field: TOPICS[0].name, fieldTouched: false, achievedOn: today(), proof: "link", link: "", photo: "", signer: "email", email: "", relationship: student ? "professor" : "manager", clubId: "", linkedin: "" };
}

// Where they left off in this tab, or else the build they typed on the landing page (browser only).
function load(student: boolean): State {
  const base = initial(student);
  if (typeof window === "undefined") return base;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<State> | null;
    if (saved && typeof saved.text === "string") return { ...base, ...saved };
    const carried = cleanBuild(localStorage.getItem(BUILD_KEY) ?? "");
    if (carried) return { ...base, text: carried, field: guessField(carried) ?? base.field };
  } catch {}
  return base;
}
const noStore = () => () => {};

// askLinkedin: a working account with no LinkedIn link adds it here to ask by email (Linear FIX-214).
export function FirstBuildWizard({ firstName, student, userId, clubs, askLinkedin = false }: { firstName: string; student: boolean; userId: string; clubs: WizardClub[]; askLinkedin?: boolean }) {
  // The server renders a placeholder; the browser renders the wizard, from what this tab remembers.
  const ready = useSyncExternalStore(noStore, () => true, () => false);
  const [s, setS] = useState<State>(() => load(student));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));

  useEffect(() => { if (ready) try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {} }, [s, ready]);

  const setText = (text: string) => setS((p) => ({ ...p, text, field: p.fieldTouched ? p.field : guessField(text) ?? p.field }));
  const go = (step: Step) => { setError(""); set({ step }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const evidence = s.proof === "link" ? s.link.trim() : s.proof === "photo" ? s.photo : "";
  const hasProof = s.proof !== "later" && isLink(evidence);
  const fieldClubs = [...clubs.filter((c) => c.mine), ...clubs.filter((c) => !c.mine && c.field === s.field), ...clubs.filter((c) => !c.mine && c.field !== s.field)].slice(0, 6);
  const club = clubs.find((c) => c.id === s.clubId);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(""); setUploading(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 2000 });
      if (item.type !== "image") throw new UploadError("Pick a photo (a video can go in a post later).");
      set({ photo: mediaUrl(item.path), proof: "photo" });
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "That photo didn't upload. Try again, or add a link instead.");
    } finally { setUploading(false); }
  }

  function finish() {
    const signer: FirstBuildSigner = !hasProof || s.signer === "none" ? { kind: "none" }
      : s.signer === "club" ? { kind: "club", clubId: s.clubId } : { kind: "email", email: s.email, relationship: s.relationship };
    if (signer.kind === "club" && !s.clubId) return setError("Pick the club that saw it.");
    if (signer.kind === "email" && !/^\S+@\S+\.\S+$/.test(s.email.trim())) return setError("Enter the email of the person who saw it.");
    if (signer.kind === "email" && askLinkedin && !s.linkedin.trim()) return setError(LINKEDIN_ADD_HERE);
    setError("");
    start(async () => {
      try { localStorage.removeItem(BUILD_KEY); sessionStorage.removeItem(KEY); } catch {}
      const r = await finishFirstBuild({ text: s.text, field: s.field, achievedOn: s.achievedOn, evidence: hasProof ? evidence : "", signer, projectId: s.projectId, linkedin: signer.kind === "email" && askLinkedin ? s.linkedin : undefined });
      // Only an error comes back (success redirects to the profile): keep everything as it was.
      if (r && !r.ok) { setS((p) => ({ ...p, projectId: r.projectId ?? p.projectId, step: r.step ?? p.step })); setError(r.message); }
    });
  }

  if (!ready) return <div className="h-96 shimmer rounded-3xl" aria-busy="true" />;
  const errorBox = error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>;

  return (
    <div className="flex flex-col gap-8">
      <SignupSteps at={s.step} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={s.step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="flex flex-col gap-7">
          {s.step === "build" && (
            <form onSubmit={(e) => { e.preventDefault(); if (cleanBuild(s.text).length >= 3) go("proof"); }} className="flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight">Welcome{firstName ? `, ${firstName}` : ""}. <span className="text-shine">What did you build?</span></h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">One line about something you made, ran, wrote or shipped: a class project counts. It becomes the first milestone on your record, and the person who saw it signs it.</p>
              </div>
              <Field label="What you built" count={s.text.length} max={300}>
                <textarea id="first-build-text" value={s.text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2} autoFocus
                  placeholder={student ? "e.g. A line-following robot that won our club's fall expo" : "e.g. Shipped the onboarding flow that cut sign-up time in half"}
                  className={cn(inputCls, "h-auto min-h-20 resize-none py-2.5 text-[17px] leading-snug")} />
              </Field>
              <div>
                <div id="fb-field-label" className="mb-3 text-sm font-medium text-text-2">Your field <span className="font-normal text-faint">{s.fieldTouched || !guessField(s.text) ? "" : "(guessed from your build; tap to change)"}</span></div>
                <div role="radiogroup" aria-labelledby="fb-field-label" className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button key={t.name} type="button" role="radio" aria-checked={s.field === t.name} onClick={() => set({ field: t.name, fieldTouched: true })}
                      className="relative rounded-lg border border-line px-3.5 py-1.5 text-sm text-muted transition aria-checked:border-transparent aria-checked:text-on-accent">
                      {s.field === t.name && <motion.span layoutId="fb-field" className="absolute inset-0 rounded-lg bg-accent" />}
                      <span className="relative">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="When did it happen?">
                <input type="date" value={s.achievedOn} max={today()} onChange={(e) => set({ achievedOn: e.target.value })} className={cn(inputCls, "max-w-48")} />
              </Field>
              {errorBox}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button type="submit" size="lg" disabled={cleanBuild(s.text).length < 3}>Next: proof <ArrowRight className="size-4" /></Button>
                <Link href="/onboarding?path=profile" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Haven&apos;t built anything yet? Set up your profile instead</Link>
              </div>
            </form>
          )}

          {s.step === "proof" && (
            <form onSubmit={(e) => { e.preventDefault(); if (s.proof === "later" || hasProof) go("signer"); else setError(s.proof === "photo" ? "Add a photo, or pick another kind of proof." : "Paste a link that starts with https://"); }} className="flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight">Show it.</h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">The person who signs looks at this first. A repo, a video, a doc, slides, a photo of it working: whatever shows <span className="text-text">&ldquo;{s.text.length > 80 ? `${s.text.slice(0, 77)}…` : s.text}&rdquo;</span> is real.</p>
              </div>
              <div role="radiogroup" aria-label="Kind of proof" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([["link", "A link", "From the tool you used: Drive, Figma, Onshape, GitHub…", Link2], ["photo", "A photo", "Of it built, running or on stage", Camera], ["later", "Add it later", "Save it as a draft for now", Clock]] as const).map(([id, label, hint, Icon]) => (
                  <button key={id} type="button" role="radio" aria-checked={s.proof === id} onClick={() => { setError(""); set({ proof: id }); }}
                    className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong aria-checked:border-accent aria-checked:ring-[3px] aria-checked:ring-accent/15">
                    <Icon className="size-5 text-accent" />
                    <span className="mt-1 font-medium">{label}</span>
                    <span className="text-xs text-muted">{hint}</span>
                  </button>
                ))}
              </div>
              {s.proof === "link" && (
                <ProofPicker field={s.field} label="Link to your proof" name="proofLink" max={1} autoFocus initial={s.link ? [s.link] : []} onLinks={(links) => set({ link: links[0] ?? "" })}
                  hint="Pick where it is for how to share it, then paste the link. Make sure the person signing can open it." />
              )}
              {s.proof === "photo" && (
                <div className="flex flex-col gap-3">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Choose a photo" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  {s.photo ? (
                    <div className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photo} alt="Your proof" className="max-h-72 rounded-2xl border border-line object-contain" />
                      <button type="button" aria-label="Remove the photo" onClick={() => set({ photo: "" })} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-surface/90 shadow"><X className="size-4" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm text-muted transition hover:border-line-strong hover:text-text">
                      {uploading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
                      {uploading ? "Uploading…" : "Choose a photo"}
                    </button>
                  )}
                </div>
              )}
              {s.proof === "later" && <p className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">It goes on your record as a draft. Add proof from your profile when you have it, then ask someone to sign.</p>}
              {errorBox}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="lg" onClick={() => go("build")}><ArrowLeft className="size-4" /> Back</Button>
                <Button type="submit" size="lg" disabled={uploading}>Next: who saw it <ArrowRight className="size-4" /></Button>
              </div>
            </form>
          )}

          {s.step === "signer" && (
            <form onSubmit={(e) => { e.preventDefault(); finish(); }} className="flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight">Who saw it?</h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{hasProof
                  ? "A signature from someone who saw it is what makes it count. They get one email with your proof, and sign in a minute. No account needed."
                  : "A signature needs proof to look at, so this one waits as a draft. Add proof from your profile, then ask."}</p>
              </div>
              {hasProof && (
                <>
                  <div role="radiogroup" aria-label="Who to ask" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([["email", student ? "A professor or mentor" : "A coworker or mentor", "By email, at their school or company", Mail], ["club", "My club", "Its officers verify it", Users], ["none", "Not yet", "Save it, ask later", Clock]] as const).map(([id, label, hint, Icon]) => (
                      <button key={id} type="button" role="radio" aria-checked={s.signer === id} onClick={() => { setError(""); set({ signer: id }); }}
                        className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong aria-checked:border-accent aria-checked:ring-[3px] aria-checked:ring-accent/15">
                        <Icon className="size-5 text-accent" />
                        <span className="mt-1 font-medium">{label}</span>
                        <span className="text-xs text-muted">{hint}</span>
                      </button>
                    ))}
                  </div>
                  {s.signer === "email" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_14rem]">
                      <Field label="Their email" hint="A school or work address carries the most weight; a personal one works too, and the signature says so.">
                        <input type="email" name="signerEmail" value={s.email} onChange={(e) => set({ email: e.target.value })} placeholder={student ? "professor@university.edu" : "coworker@company.com"} autoComplete="off" className={inputCls} />
                      </Field>
                      <Field label="They are">
                        <select value={s.relationship} onChange={(e) => set({ relationship: e.target.value })} className={inputCls}>
                          {Object.entries(RELATIONSHIPS).map(([id, label]) => <option key={id} value={id}>{label.replace(/^(a|their lab's) /, (m) => (m === "their lab's " ? "my lab's " : "my "))}</option>)}
                        </select>
                      </Field>
                      {askLinkedin && (
                        <div className="sm:col-span-2">
                          <Field label="Your LinkedIn profile" hint={`${LINKEDIN_WHY} ${LINKEDIN_PRIVATE}`}>
                            <input type="text" name="linkedin" value={s.linkedin} onChange={(e) => set({ linkedin: e.target.value })} inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder={LINKEDIN_PLACEHOLDER} className={inputCls} />
                          </Field>
                        </div>
                      )}
                    </div>
                  )}
                  {s.signer === "club" && (fieldClubs.length ? (
                    <div role="radiogroup" aria-label="Your club" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {fieldClubs.map((c) => (
                        <button key={c.id} type="button" role="radio" aria-checked={s.clubId === c.id} onClick={() => set({ clubId: c.id })}
                          className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-line-strong aria-checked:border-accent aria-checked:ring-[3px] aria-checked:ring-accent/15">
                          <Building2 className="size-5 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.name}</span><span className="block text-xs text-muted">{c.mine ? "You're a member" : [c.field, `${c.members} member${c.members === 1 ? "" : "s"}`, "joins you"].filter(Boolean).join(" · ")}</span></span>
                          {s.clubId === c.id && <Check className="size-4 text-accent" />}
                        </button>
                      ))}
                    </div>
                  ) : <p className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">No open clubs here yet. Ask someone by email for now; you can start your club from Club once you&apos;re in.</p>)}
                </>
              )}
              {errorBox}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="lg" onClick={() => go("proof")} disabled={pending}><ArrowLeft className="size-4" /> Back</Button>
                <Button type="submit" size="lg" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {pending ? "Putting it on your record…" : !hasProof || s.signer === "none" ? "Finish" : s.signer === "club" ? `Send to ${club?.name ?? "the club"}` : "Ask for a signature"}
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
