"use client";

import { useState, useTransition } from "react";
import { Button, inputCls } from "@/components/ui";
import { addMilestoneEvidence } from "@/lib/milestones";
import { RELATIONSHIPS } from "@/lib/vouch-email";
import { requestVouch } from "@/lib/vouches";

export function WelcomeNext({ id, hasEvidence, student }: { id: string; hasEvidence: boolean; student: boolean }) {
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const [linkedin, setLinkedin] = useState(false);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState(student ? "professor" : "manager");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [evidence, setEvidence] = useState("");
  const canAsk = hasEvidence || added;
  const next = canAsk ? "Ask someone to sign" : "Add evidence";

  function submit(data: FormData) {
    setError("");
    start(async () => {
      if (!canAsk) {
        const result = await addMilestoneEvidence(id, String(data.get("evidence") ?? ""));
        if (!result.ok) { setError(result.message); return; }
        setAdded(true);
        setOpen(false);
        return;
      }
      const result = await requestVouch(id, String(data.get("email") ?? ""), String(data.get("relationship") ?? ""), false, String(data.get("linkedin") ?? ""));
      if (!result.ok) {
        if (result.linkedin) setLinkedin(true);
        setError(result.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) return <p role="status" className="mt-4 text-sm text-ok">Signature request sent.</p>;
  return (
    <div className="mt-4">
      {added && <p role="status" className="mb-2 text-sm text-ok">Evidence added.</p>}
      {open ? (
        <form action={submit} className="grid max-w-lg gap-3">
          {canAsk ? (
            <>
              <p className="text-sm text-muted">Choose someone outside the project who saw the work. They’ll get an email and can sign without an account.</p>
              <label className="grid gap-1 text-sm">Signer’s email<input name="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required maxLength={254} className={inputCls} /></label>
              <label className="grid gap-1 text-sm">How they know your work
                <select name="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls}>
                  {Object.entries(RELATIONSHIPS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              {linkedin && <label className="grid gap-1 text-sm">Your LinkedIn profile<input name="linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} type="url" required maxLength={200} placeholder="https://www.linkedin.com/in/your-name" className={inputCls} /></label>}
            </>
          ) : (
            <label className="grid gap-1 text-sm">Evidence link<input name="evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} required maxLength={300} placeholder="https://…" className={inputCls} /></label>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Working…" : canAsk ? "Send signature request" : "Save evidence"}</Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>{next}</Button>
      )}
    </div>
  );
}
