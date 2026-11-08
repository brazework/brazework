"use client";
import { Check, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { FIELDS, TOPICS, cn, type Profile } from "@/lib/forge";
import { changePassword, saveMessageSettings, saveProfileSettings, unblockPerson, type SettingsState } from "@/lib/settings";
import { submitWithoutReset } from "@/lib/submit";

const init: SettingsState = { ok: false, message: "" };

function Status({ state }: { state: SettingsState }) {
  if (!state.message) return null;
  return <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</p>;
}

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfileSettings, init);
  const [picked, setPicked] = useState<string[]>(profile.interests ?? []);
  const [group, setGroup] = useState<string>(TOPICS.find((t) => t.name === profile.field)?.name ?? TOPICS[0].name);
  const topics = TOPICS.find((t) => t.name === group)?.topics ?? [];
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      {picked.map((t) => <input key={t} type="hidden" name="interests" value={t} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><input name="first_name" defaultValue={profile.first_name} maxLength={80} className={inputCls} /></Field>
        <Field label="Last name"><input name="last_name" defaultValue={profile.last_name} maxLength={80} className={inputCls} /></Field>
      </div>
      <Field label="Headline"><input name="headline" defaultValue={profile.headline} maxLength={200} className={inputCls} /></Field>
      <Field label="Field"><select name="field" defaultValue={profile.field} className={inputCls}>{FIELDS.map((f) => <option key={f}>{f}</option>)}</select></Field>
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

// Accent colours. Mono = the ink colour (black in light mode, white in dark).
const ACCENTS = [
  { id: "mono", label: "Mono", swatch: "var(--text)" },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "violet", label: "Violet", swatch: "#8b5cf6" },
  { id: "emerald", label: "Emerald", swatch: "#10b981" },
  { id: "amber", label: "Amber", swatch: "#f59e0b" },
  { id: "rose", label: "Rose", swatch: "#f43f5e" },
] as const;
type Accent = (typeof ACCENTS)[number]["id"];
const readAccent = (): Accent => (ACCENTS.find((a) => a.id === document.documentElement.dataset.accent)?.id ?? "mono");
const subAccent = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent"] });
  return () => mo.disconnect();
};
function applyAccent(a: Accent) {
  const root = document.documentElement;
  try {
    if (a === "mono") { root.removeAttribute("data-accent"); localStorage.removeItem("forge-accent"); }
    else { root.setAttribute("data-accent", a); localStorage.setItem("forge-accent", a); }
  } catch {}
}

// Same storage as the header toggle: html[data-theme] + localStorage "forge-theme"; System clears both.
export function AppearanceSettings() {
  const choice = useSyncExternalStore(sub, read, () => "system" as Choice);
  const accent = useSyncExternalStore(subAccent, readAccent, () => "mono" as Accent);
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
        <div className="mb-3 text-sm font-medium text-text-2">Accent colour</div>
        <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ACCENTS.map((a) => (
            <button key={a.id} role="radio" aria-checked={accent === a.id} onClick={() => applyAccent(a.id)} className="flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-xs text-muted transition hover:text-text aria-checked:border-text aria-checked:text-text">
              <span className="grid size-7 place-items-center rounded-full ring-1 ring-line-strong" style={{ background: a.swatch }}>
                {accent === a.id && <Check className="size-4 text-bg" />}
              </span>
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">Buttons, highlights and the sparks on the home page follow your accent. Saved on this device.</p>
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
  const whoOpts: [typeof w, string][] = [["everyone", "Anyone on Forge"], ["communities", "Connections and people in your communities"], ["connections", "Connections only"]];
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
      <p className="text-sm text-muted">Take the one-minute tour of Forge again.</p>
      <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("forge:tour", { detail: "welcome" }))}>Replay the tour</Button>
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, init);
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-5 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password"><input name="password" type="password" autoComplete="new-password" minLength={8} className={inputCls} /></Field>
        <Field label="Confirm"><input name="confirm" type="password" autoComplete="new-password" minLength={8} className={inputCls} /></Field>
      </div>
      <Status state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Change password</Button>
    </form>
  );
}
