"use client";
import { Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, inputCls, selectPillCls } from "@/components/ui";
import { LIMITS, PRIVACY, ROLE_LABEL, type Role } from "@/lib/communities";
import { cn } from "@/lib/forge";
import { submitWithoutReset } from "@/lib/submit";
import { approveJoin, declineJoin, removeMember, setMemberRole, unbanMember, updateCommunitySettings, type CreateState } from "../../../communities/actions";

const small = "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition disabled:opacity-50";

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg((await fn()).message));
  return { pending, msg, run };
}

export function RequestActions({ cid, uid }: { cid: string; uid: string }) {
  const { pending, msg, run } = useAct();
  if (msg) return <span className="text-sm text-muted">{msg}</span>;
  return (
    <div className="flex gap-2">
      <button className={cn(small, "bg-accent text-on-accent hover:opacity-90")} disabled={pending} onClick={() => run(() => approveJoin(cid, uid))}>Approve</button>
      <button className={cn(small, "text-muted hover:bg-hover hover:text-text")} disabled={pending} onClick={() => run(() => declineJoin(cid, uid))}>Decline</button>
    </div>
  );
}

export function MemberActions({ cid, uid, name, current, assignable, canRemove }: { cid: string; uid: string; name: string; current: Role; assignable: Role[]; canRemove: boolean }) {
  const { pending, msg, run } = useAct();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {assignable.length > 0 && (
        <label className="sr-only" htmlFor={`role-${uid}`}>Role for {name}</label>
      )}
      {assignable.length > 0 && (
        <select id={`role-${uid}`} defaultValue={current} disabled={pending} onChange={(e) => run(() => setMemberRole(cid, uid, current, e.target.value as Role))} className={selectPillCls}>
          {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      )}
      {canRemove && (
        <>
          <button className={cn(small, "text-muted hover:bg-hover hover:text-text")} disabled={pending} onClick={() => confirm(`Remove ${name} from the community?`) && run(() => removeMember(cid, uid, current, false))}>Remove</button>
          <button className={cn(small, "text-danger hover:bg-hover")} disabled={pending} onClick={() => confirm(`Remove and ban ${name}? They won't be able to rejoin.`) && run(() => removeMember(cid, uid, current, true))}>Ban</button>
        </>
      )}
      {msg && <span className="w-full text-right text-xs text-muted">{msg}</span>}
    </div>
  );
}

export function BanRow({ cid, uid, name, at }: { cid: string; uid: string; name: string; at: string }) {
  const { pending, msg, run } = useAct();
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1"><div className="font-medium">{name || "Former member"}</div><div className="text-xs text-faint">Banned {at}</div></div>
      {msg ? <span className="text-sm text-muted">{msg}</span> : <button className={cn(small, "border border-line hover:bg-hover")} disabled={pending} onClick={() => run(() => unbanMember(cid, uid))}>Unban</button>}
    </div>
  );
}

export function SettingsForm({ cid, about, rules, privacy, words, holdNewLinks, canAutomod }: { cid: string; about: string; rules: string; privacy: string; words: string; holdNewLinks: boolean; canAutomod: boolean }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(updateCommunitySettings, { ok: false, message: "" });
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      <input type="hidden" name="cid" value={cid} />
      <Field label="About"><textarea name="about" defaultValue={about} maxLength={LIMITS.about} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} /></Field>
      <Field label="Rules"><textarea name="rules" defaultValue={rules} maxLength={LIMITS.rules} rows={5} className={cn(inputCls, "h-auto resize-y py-3")} /></Field>
      <Field label="Who can join">
        <select name="privacy" defaultValue={privacy} className={inputCls}>{PRIVACY.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
      </Field>
      {canAutomod && (
        <fieldset className="flex flex-col gap-4 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-medium">Auto-moderation</legend>
          <Field label="Hold posts containing" hint="One word or phrase per line, up to 50."><textarea name="words" defaultValue={words} maxLength={LIMITS.wordsText} rows={4} className={cn(inputCls, "h-auto resize-y py-3 font-mono text-sm")} /></Field>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="holdNewLinks" defaultChecked={holdNewLinks} className="mt-0.5 size-4 accent-[var(--text)]" /><span>Hold posts with links from members who joined in the last week</span></label>
        </fieldset>
      )}
      {state.message && <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</p>}
      <Button type="submit" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Save settings</Button>
    </form>
  );
}
