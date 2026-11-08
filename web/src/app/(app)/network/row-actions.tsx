"use client";
import { useState, useTransition } from "react";
import { ConnectDialog } from "@/components/network/connect-dialog";
import { smallGhost, smallOutline, smallPrimary } from "@/components/network/person-row";
import { acceptAllRequests, messageMember, removeConnection, respondToRequest, sendConnectionRequest, toggleFollow } from "@/lib/network";

type Kind = "invite" | "connection" | "sent" | "following" | "suggested";

// The buttons on one network row. The server action re-renders the page, so the row moves to the right tab.
export function RowActions({ kind, id, personId, firstName = "" }: { kind: Kind; id: string; personId?: string; firstName?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [asking, setAsking] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message: string } | void>, after = "") =>
    start(async () => {
      setError("");
      const r = await fn().catch(() => ({ ok: false, message: "Couldn't do that. Check your connection." }));
      if (r && !r.ok) setError(r.message);
      else if (after) setDone(after);
    });

  if (done) return <span className="text-sm text-muted">{done}</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {kind === "invite" && (
        <>
          <button className={smallPrimary} disabled={pending} onClick={() => run(() => respondToRequest(id, true))}>Accept</button>
          <button className={smallGhost} disabled={pending} onClick={() => run(() => respondToRequest(id, false))}>Decline</button>
        </>
      )}
      {kind === "connection" && personId && (
        <>
          <button className={smallOutline} disabled={pending} onClick={() => run(() => messageMember(personId))}>Message</button>
          <button className={smallGhost} disabled={pending} onClick={() => confirm("Remove this connection?") && run(() => removeConnection(id))}>Remove</button>
        </>
      )}
      {kind === "sent" && <button className={smallOutline} disabled={pending} onClick={() => run(() => removeConnection(id))}>Withdraw</button>}
      {kind === "following" && <button className={smallOutline} disabled={pending} onClick={() => run(() => toggleFollow(id, false))}>Unfollow</button>}
      {kind === "suggested" && (
        <>
          <button className={smallPrimary} disabled={pending} onClick={() => setAsking(true)}>Connect</button>
          <ConnectDialog firstName={firstName} open={asking} onClose={() => setAsking(false)} onSend={(note) => { setAsking(false); run(() => sendConnectionRequest(id, note), "Request sent"); }} />
        </>
      )}
      {error && <p role="alert" className="w-full text-right text-xs text-danger">{error}</p>}
    </div>
  );
}

export function AcceptAll() {
  const [pending, start] = useTransition();
  return (
    <button className={smallOutline} disabled={pending} onClick={() => start(async () => { await acceptAllRequests(); })}>
      Accept all
    </button>
  );
}
