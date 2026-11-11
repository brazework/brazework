"use client";
import { Loader2, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { shareProject } from "@/lib/projects";

// The owner posts progress on a project: it goes to the feed as a project post and shows under Updates.
// Posting keeps you where you are (the project page, or the Projects workbench); it never opens the feed.
export function PostUpdate({ projectId, title, className, autoFocus = false }: { projectId: string; title: string; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const id = `pu-${projectId}`;
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await shareProject(projectId, body); setMsg({ ok: r.ok, text: r.message }); if (r.ok) { setBody(""); router.refresh(); } }); }} className={className ?? "glass-card rounded-3xl p-4"}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium"><Megaphone className="size-4" /> Post an update</label>
      <textarea id={id} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={2} placeholder={`What changed on ${title}? A result, a photo-worthy moment, what's next…`} style={{ outline: "none" }} className="mt-2 w-full resize-y rounded-xl border border-line bg-surface/70 px-3.5 py-2.5 text-[15px] placeholder:text-faint focus:border-text" />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending || !body.trim()} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent disabled:opacity-50">{pending && <Loader2 className="size-4 animate-spin" />} Post update</button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ok" : "text-xs text-danger"}>{msg.text}</span>}
        <span className="ml-auto text-[11px] text-faint">Also shows in your followers&apos; feeds</span>
      </div>
    </form>
  );
}
