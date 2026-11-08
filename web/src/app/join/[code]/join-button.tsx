"use client";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { acceptInvite } from "@/lib/invites";

export function JoinButton({ code, name }: { code: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <Button size="lg" disabled={pending} onClick={() => start(async () => { const r = await acceptInvite(code); if (r && !r.ok) setError(r.message); })}>
        {pending && <Loader2 className="size-4 animate-spin" />} Join {name}
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </>
  );
}
