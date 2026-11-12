"use client";
import { Check, ChevronRight, Loader2, Monitor, Moon, Plug, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { ALL_TOPICS, FIELDS, TOPICS, cn, type Profile } from "@/lib/forge";
import { gradYearOptions } from "@/lib/profile-meta";
import { deleteAllChats } from "@/lib/copilot-chats";
import { changePassword, deleteAccount, saveEmailAlerts, saveEmailPrefs, saveMessageSettings, saveProfileSettings, type SettingsState, unblockPerson } from "@/lib/settings";
import { submitWithoutReset } from "@/lib/submit";

const init: SettingsState = { ok: false, message: "" };

function Status({ state }: { state: SettingsState }) {
  if (!state.message) return null;
  return <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</p>;
}

// gradYear: undefined until supabase/grad-year.sql has run (the field stays hidden); null = not set.
export function ProfileSettings({ profile, gradYear }: { profile: Profile; gradYear?: number | null }) {
  const [state, action, pending] = useActionState(saveProfileSettings, init);
  // Only current topics count (renamed or retired ones would be invisible yet still submitted).
  const [picked, setPicked] = useState<string[]>((profile.interests ?? []).filter((t) => ALL_TOPICS.includes(t)));
  const fieldKnown = FIELDS.includes(profile.field);
  const [group, setGroup] = useState<string>(TOPICS.find((t) => t.name === profile.field)?.name ?? TOPICS[0].name);
  const topics = TOPICS.find((t) => t.name === group)?.topics ?? [];
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      {picked.map((t) => <input key={t} type="hidden" name="interests" value={t} />)}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name"><input name="first_name" defaultValue={profile.first_name} maxLength={80} className={inputCls} /></Field>
        <Field label="Last name"><input name="last_name" defaultValue={profile.last_name} maxLength={80} className={inputCls} /></Field>
      </div>
      <Field label="Headline"><input name="headline" defaultValue={profile.headline} maxLength={200} className={inputCls} /></Field>
      <Field label="Field"><select name="field" defaultValue={fieldKnown ? profile.field : ""} className={inputCls}>{!fieldKnown && <option value="" disabled>Pick your field</option>}{FIELDS.map((f) => <option key={f}>{f}</option>)}</select></Field>
      {gradYear !== undefined && (
        <Field label="Graduation year" optional hint="Companies on Find builders can filter by class year.">
          <select name="grad_year" defaultValue={gradYear ?? ""} aria-label="Graduation year" className={inputCls}>
            <option value="">Not set</option>
            {gradYearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
      )}
      <div>
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium text-text-2">Interests</span>
          <span className={cn("font-mono text-xs", picked.length >= 3 ? "text-faint" : "text-danger")}>{picked.length} picked · at least 3</span>
        </div>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
          {TOPICS.map((t) => <button key={t.name} type="button" aria-pressed={group === t.name} onClick={() => setGroup(t.name)} className="shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap text-muted transition aria-pressed:bg-raised aria-pressed:text-text">{t.name}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => {
            const on = picked.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t) : [...p, t]))} className={cn("inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm transition", on ? "border-text text-text" : "border-line text-muted hover:text-text")}>
                {on && <Check className="size-3.5" />} {t}
              </button>
            );
          })}
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Save profile</Button>
    </form>
  );
}

type Choice = "light" | "dark" | "system";
const read = (): Choice => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
};
const sub = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};

function applyTheme(c: Choice) {
  const root = document.documentElement;
  try {
    if (c === "system") { root.removeAttribute("data-theme"); localStorage.removeItem("forge-theme"); }
    else { root.setAttribute("data-theme", c); localStorage.setItem("forge-theme", c); }
  } catch {}
}

// App-wide themes (html[data-skin], saved as localStorage "forge-skin"). Mono = no attribute.
const SKINS = [
  { id: "mono", label: "Mono", bg: "#0b0b0d", card: "#18181b", grad: "linear-gradient(135deg, #fafafa, #a1a1aa)" },
  { id: "fire", label: "Brazework Fire", bg: "#120a07", card: "#21150e", grad: "linear-gradient(135deg, #ffd166, #ff8a3d 45%, #ff4d4d)" },
  { id: "blueprint", label: "Blueprint", bg: "#0a1c35", card: "#112d52", grad: "linear-gradient(135deg, #a5d8ff, #7cc4ff 50%, #5b9dff)" },
  { id: "aurora", label: "Aurora", bg: "#0b0a1a", card: "#171433", grad: "linear-gradient(135deg, #22d3ee, #818cf8 50%, #e879f9)" },
  { id: "emerald", label: "Emerald", bg: "#06140f", card: "#0e241b", grad: "linear-gradient(135deg, #d9f99d, #34d399 50%, #22d3ee)" },
] as const;
type Skin = (typeof SKINS)[number]["id"];
const readSkin = (): Skin => (SKINS.find((k) => k.id === document.documentElement.dataset.skin)?.id ?? "mono");
const subSkin = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });
  return () => mo.disconnect();
};
function applySkin(k: Skin) {
  const root = document.documentElement;
  try {
    if (k === "mono") { root.removeAttribute("data-skin"); localStorage.removeItem("forge-skin"); }
    else { root.setAttribute("data-skin", k); localStorage.setItem("forge-skin", k); }
  } catch {}
}

// Same storage as the header toggle: html[data-theme] + localStorage "forge-theme"; System clears both.
export function AppearanceSettings() {
  const choice = useSyncExternalStore(sub, read, () => "system" as Choice);
  const skin = useSyncExternalStore(subSkin, readSkin, () => "mono" as Skin);
  const opts: [Choice, string, typeof Sun][] = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]];
  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {opts.map(([id, label, Icon]) => (
          <button key={id} role="radio" aria-checked={choice === id} onClick={() => applyTheme(id)} className="flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-sm text-muted transition hover:text-text aria-checked:border-text aria-checked:text-text">
            <Icon className="size-5" /> {label}
          </button>
        ))}
      </div>
      <div>
        <div className="mb-3 text-sm font-medium text-text-2">Theme</div>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SKINS.map((k) => (
            <button key={k.id} role="radio" aria-checked={skin === k.id} onClick={() => applySkin(k.id)} className="group overflow-hidden rounded-2xl border border-line text-left transition hover:-translate-y-0.5 aria-checked:border-transparent aria-checked:ring-2 aria-checked:ring-[var(--accent)]">
              {/* A tiny preview of the theme: its background, a card and its gradient. */}
              <div className="relative h-20 p-2.5" style={{ background: k.bg }}>
                <div className="h-full rounded-lg p-2" style={{ background: k.card }}>
                  <div className="h-1.5 w-1/2 rounded-full bg-white/30" />
                  <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-white/15" />
                  <div className="mt-2.5 h-3.5 w-12 rounded-full" style={{ background: k.grad }} />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-xs font-medium">
                {k.label}
                {skin === k.id && <Check className="size-3.5" />}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">Themes change the whole app, in light and dark. Saved on this device.</p>
      </div>
    </div>
  );
}

export function MessagingSettings({ requestsOn, who }: { requestsOn: boolean; who: "everyone" | "communities" | "connections" }) {
  const [on, setOn] = useState(requestsOn);
  const [w, setW] = useState(who);
  const [msg, setMsg] = useState<SettingsState>(init);
  const [pending, start] = useTransition();
  const save = (nextOn: boolean, nextWho: typeof w) => start(async () => setMsg(await saveMessageSettings(nextOn, nextWho)));
  const whoOpts: [typeof w, string][] = [["everyone", "Anyone on Brazework"], ["communities", "Connections and people in your communities"], ["connections", "Connections only"]];
  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-start justify-between gap-4">
        <span><span className="text-sm font-medium">Message requests</span><span className="block text-sm text-faint">Messages from people you&apos;re not connected with wait in a separate Requests tab.</span></span>
        <input type="checkbox" role="switch" checked={on} disabled={pending} onChange={(e) => { setOn(e.target.checked); save(e.target.checked, w); }} className="mt-1 size-5 shrink-0 accent-[var(--text)]" />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who can send you a request</legend>
        <div className="flex flex-col gap-2">
          {whoOpts.map(([id, label]) => (
            <label key={id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm has-checked:border-text">
              <input type="radio" name="who" checked={w === id} disabled={pending} onChange={() => { setW(id); save(on, id); }} className="accent-[var(--text)]" /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Status state={msg} />
    </div>
  );
}

export function BlockedList({ people }: { people: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string[]>([]);
  const shown = people.filter((p) => !done.includes(p.id));
  if (!shown.length) return <p className="text-sm text-muted">You haven&apos;t blocked anyone. Blocking from a message request stops that person from messaging you.</p>;
  return (
    <ul className="divide-y divide-line">
      {shown.map((p) => (
        <li key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <span className="text-sm">{p.name}</span>
          <button disabled={pending} onClick={() => start(async () => { const r = await unblockPerson(p.id); if (r.ok) setDone((d) => [...d, p.id]); })} className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm transition hover:bg-hover">Unblock</button>
        </li>
      ))}
    </ul>
  );
}

export function HelpSettings() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">Take the one-minute tour of Brazework again.</p>
      <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("forge:tour", { detail: "welcome" }))}>Replay the tour</Button>
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, init);
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="New password"><input name="password" type="password" autoComplete="new-password" minLength={8} className={inputCls} /></Field>
        <Field label="Confirm"><input name="confirm" type="password" autoComplete="new-password" minLength={8} className={inputCls} /></Field>
      </div>
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Change password</Button>
    </form>
  );
}

// What Ember can and can't see, and deleting your chats with it (supabase/copilot-chats.sql).
export function EmberSettings({ saving, chats }: { saving: boolean; chats: number }) {
  const [left, setLeft] = useState(chats);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4 text-sm leading-relaxed text-text-2">
      <ul className="space-y-2">
        <li><strong className="font-medium text-text">What Ember reads:</strong> your profile, clubs and projects, and what any member can see on Brazework (clubs, events, people, posts), plus public GitHub when you ask about a repo.</li>
        <li><strong className="font-medium text-text">What it never reads:</strong> your direct messages. In a group chat it reads recent messages only when someone there asks @Ember or taps Catch me up.</li>
        <li><strong className="font-medium text-text">What it does on its own:</strong> nothing. It prepares cards; posting, joining, RSVPing or messaging happens only when you confirm.</li>
        <li><strong className="font-medium text-text">Your chats:</strong> {saving ? "private to you, and deleted 180 days after you last use them. A thumbs up or down sends only that question and answer to the Brazework team." : "not kept after you leave the page."}</li>
      </ul>
      {saving && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="text-muted">{left ? `${left} saved ${left === 1 ? "chat" : "chats"}` : "No saved chats"}</span>
          <button type="button" disabled={!left || pending} onClick={() => { if (!confirm("Delete all your Ember chats? This can't be undone.")) return; start(async () => { const r = await deleteAllChats(); setMsg(r.ok ? "All your Ember chats are deleted." : r.message); if (r.ok) setLeft(0); }); }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 font-medium text-text transition hover:border-danger hover:text-danger disabled:opacity-40">
            {pending && <Loader2 className="size-4 animate-spin" />} Delete all Ember chats
          </button>
          {msg && <p role="status" className="w-full text-xs text-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}

// Settings → AI tools: the way into Settings → Your tools (Linear FIX-78), with how many are connected.
export function AiToolsSettings({ connected, total }: { connected: number; total: number }) {
  return (
    <Link href="/settings/tools" className="group -m-2 flex items-center gap-4 rounded-2xl p-2 transition hover:bg-hover">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-text text-surface"><Plug className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Connect Claude Code, Cursor, VS Code, Codex…</span>
        <span className="block text-sm text-muted">{total ? `${connected} of ${total} ${total === 1 ? "tool" : "tools"} connected` : "Bring your Brazework into the agent you build with. Read-only."}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-text" />
    </Link>
  );
}


// Your data: download it all, or delete your account.
export function YourDataSettings() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<SettingsState>({ ok: false, message: "" });
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <a href="/api/export" download className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover">Download my data</a>
        <p className="mt-2 text-xs text-muted">A JSON file with your profile, posts, replies, projects, milestones, messages you sent, clubs, follows and saved posts, plus links to your files. Brazework never pulls records from your school. <Link href="/privacy" className="underline hover:text-text">How Brazework handles your data</Link></p>
      </div>
      <form className="border-t border-line pt-6" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await deleteAccount(confirm); setState(r); if (r.ok) { router.replace("/"); router.refresh(); } }); }}>
        <div className="text-sm font-medium text-danger">Delete my account</div>
        <p className="mt-1 text-xs text-muted">Deletes your profile, posts, replies, projects, milestones and messages, and your uploaded files. Verification records keep only an anonymous entry. Clubs you run with other members need a new owner first (Hand off). This can&apos;t be undone.</p>
        <label className="mt-3 block text-xs text-muted" htmlFor="delete-confirm">Type DELETE to confirm</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="h-10 w-40 rounded-full border border-line bg-surface-2 px-3 text-sm" />
          <button type="submit" disabled={confirm !== "DELETE" || pending} className="h-10 rounded-full bg-danger px-4 text-sm font-medium text-white disabled:opacity-40">{pending ? "Deleting…" : "Delete my account"}</button>
        </div>
        {state.message && <p role="status" className={state.ok ? "mt-2 text-sm text-ok" : "mt-2 text-sm text-danger"}>{state.message}</p>}
      </form>
    </div>
  );
}

export type EmailAlerts = { messages: boolean; requests: boolean; comments: boolean };

const ALERT_KINDS: { key: keyof EmailAlerts; title: string; desc: string }[] = [
  { key: "messages", title: "New messages", desc: "When someone messages you and you haven't read it yet." },
  { key: "requests", title: "Connection requests", desc: "When someone wants to connect." },
  { key: "comments", title: "Comments on your posts", desc: "When someone comments on something you posted." },
];

export function EmailSettings({ weekly, alerts }: { weekly: boolean; alerts?: EmailAlerts }) {
  const [on, setOn] = useState(weekly);
  const [kinds, setKinds] = useState<EmailAlerts | undefined>(alerts);
  const [msg, setMsg] = useState<SettingsState>(init);
  const [pending, start] = useTransition();
  const toggle = (key: keyof EmailAlerts, v: boolean) => {
    if (!kinds) return;
    const next = { ...kinds, [key]: v };
    setKinds(next);
    start(async () => setMsg(await saveEmailAlerts(next)));
  };
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start justify-between gap-4">
        <span><span className="text-sm font-medium">Your week, by email</span><span className="block text-sm text-faint">Once a week: what&apos;s waiting on you and what happened in your clubs. Never sent when there&apos;s nothing to say.</span></span>
        <input id="email-weekly" type="checkbox" role="switch" checked={on} disabled={pending} onChange={(e) => { const v = e.target.checked; setOn(v); start(async () => setMsg(await saveEmailPrefs(v))); }} className="mt-1 size-5 shrink-0 accent-[var(--text)]" />
      </label>
      {kinds && (
        <>
          <p className="mt-2 text-sm text-faint">When you&apos;re away: one email at most every hour, only for what you haven&apos;t seen in the app.</p>
          {ALERT_KINDS.map((k) => (
            <label key={k.key} className="flex items-start justify-between gap-4">
              <span><span className="text-sm font-medium">{k.title}</span><span className="block text-sm text-faint">{k.desc}</span></span>
              <input id={`email-alert-${k.key}`} type="checkbox" role="switch" checked={kinds[k.key]} disabled={pending} onChange={(e) => toggle(k.key, e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--text)]" />
            </label>
          ))}
        </>
      )}
      <Status state={msg} />
    </div>
  );
}
