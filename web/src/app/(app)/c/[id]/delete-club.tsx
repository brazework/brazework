"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { submitWithoutReset } from "@/lib/submit";
import { deleteClub } from "../../communities/actions";

export function DeleteClubForm({ id, name }: { id: string; name: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(deleteClub, { ok: false, message: "" });

  return (
    <details className="mt-6 border-t border-line pt-4">
      <summary className="w-fit cursor-pointer text-sm font-medium text-danger">Delete club</summary>
      <form onSubmit={submitWithoutReset(action)} className="mt-3 grid max-w-lg gap-3">
        <p className="text-sm text-muted">
          This permanently removes the club, its posts, events, chats and memberships.
          Members keep their projects and signed milestones. Pending club reviews return to drafts.
        </p>
        <input type="hidden" name="cid" value={id} />
        <Field label={`Type the club name to confirm: ${name}`}>
          <input name="name" required maxLength={100} autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputCls} />
        </Field>
        {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <Button type="submit" variant="outline" className="justify-self-start border-danger text-danger" disabled={pending || confirmation !== name}>
          {pending ? "Deleting…" : "Permanently delete club"}
        </Button>
      </form>
    </details>
  );
}
