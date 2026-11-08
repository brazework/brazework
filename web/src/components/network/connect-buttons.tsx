"use client";
import { Check, Loader2, MessageSquare, UserPlus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { messageMember, removeConnection, respondToRequest, sendConnectionRequest, toggleFollow, type Relationship } from "@/lib/network";
import { ConnectDialog } from "./connect-dialog";
import { smallGhost, smallOutline, smallPrimary } from "./person-row";

// Connect / Pending / Accept / Connected + Follow + Message, as on the vanilla profile page.
// Optimistic: the buttons change at once and fall back to the server's state if the action fails.
export function ConnectButtons({ personId, firstName, relationship, showMessage = true }: { personId: string; firstName: string; relationship: Relationship; showMessage?: boolean }) {
  const [pending, start] = useTransition();
  const [rel, setRel] = useOptimistic(relationship, (cur, next: Partial<Relationship>) => ({ ...cur, ...next }));
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);

  const run = (next: Partial<Relationship>, action: () => Promise<{ ok: boolean; message: string } | void>) =>
    start(async () => {
      setError("");
      setRel(next);
      const res = await action().catch(() => ({ ok: false, message: "Couldn't do that. Check your connection." }));
      if (res && !res.ok) setError(res.message);
    });

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {rel.status === "none" && (
          <button className={smallPrimary} disabled={pending} onClick={() => setAsking(true)}>
            <UserPlus className="size-4" /> Connect
          </button>
        )}
        {rel.status === "sent" && (
          <button className={smallOutline} disabled={pending} onClick={() => rel.connId && run({ status: "none", connId: null }, () => removeConnection(rel.connId!))}>
            Pending · Withdraw
          </button>
        )}
        {rel.status === "received" && (
          <>
            <button className={smallPrimary} disabled={pending} onClick={() => rel.connId && run({ status: "connected", following: true }, () => respondToRequest(rel.connId!, true))}>
              <Check className="size-4" /> Accept
            </button>
            <button className={smallGhost} disabled={pending} onClick={() => rel.connId && run({ status: "none", connId: null }, () => respondToRequest(rel.connId!, false))}>
              Decline
            </button>
          </>
        )}
        {rel.status === "connected" && (
          <span className={smallOutline} aria-label="Connected">
            <Check className="size-4" /> Connected
          </span>
        )}
        <button className={smallOutline} disabled={pending} aria-pressed={rel.following} onClick={() => run({ following: !rel.following }, () => toggleFollow(personId, !rel.following))}>
          {rel.following ? "Following" : "Follow"}
        </button>
        {showMessage && (
          <button className={smallGhost} disabled={pending} onClick={() => start(async () => { const r = await messageMember(personId); if (r && !r.ok) setError(r.message); })}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />} Message
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <ConnectDialog
        firstName={firstName}
        open={asking}
        onClose={() => setAsking(false)}
        onSend={(note) => {
          setAsking(false);
          run({ status: "sent", following: true }, () => sendConnectionRequest(personId, note));
        }}
      />
    </div>
  );
}
