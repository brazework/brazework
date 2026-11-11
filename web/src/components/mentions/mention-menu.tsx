// No "use client": a hook for client components (the composer), bundled with them.
import { AtSign, FolderGit2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { keepMentioned, mentionQuery, type Mention } from "@/lib/mention-text";
import { mentionSuggestions, type MentionPerson } from "@/lib/mentions";

type Project = { id: string; title: string };
type Item = { kind: "project"; p: Project } | { kind: "person"; p: MentionPerson };

// @mention autocomplete for a textarea: type "@" and a name, pick with the arrow keys and Enter
// (or Tab, or a click), and "@First Last" goes into the text. `mentions` is what to send with the
// post: everyone picked whose name is still in the text. Given `projects` (your own), the matching
// ones come first: picking one writes "@Title" and calls onProject instead of mentioning a person.
export function useMentions({ text, setText, ref, enabled, suggest = mentionSuggestions, projects = [], onProject }: { text: string; setText: (v: string) => void; ref: RefObject<HTMLTextAreaElement | null>; enabled: boolean; suggest?: (q: string) => Promise<MentionPerson[]>; projects?: Project[]; onProject?: (p: Project) => void }) {
  const [picked, setPicked] = useState<Mention[]>([]);
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [people, setPeople] = useState<MentionPerson[]>([]);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const listId = useId();

  const q = query?.q ?? null;
  useEffect(() => {
    if (q === null || !enabled) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const found = await suggest(q).catch(() => []);
      if (mine === seq.current) { setPeople(found); setActive(0); }
    }, 120);
    return () => clearTimeout(t);
  }, [q, suggest, enabled]);

  // Your projects whose title has what you've typed, then the people.
  const projectHits = q === null || !onProject ? [] : projects.filter((x) => x.title.toLowerCase().includes(q.toLowerCase())).slice(0, 4);
  const items: Item[] = [...projectHits.map((p) => ({ kind: "project" as const, p })), ...(enabled ? people : []).map((p) => ({ kind: "person" as const, p }))];
  const current = Math.min(active, Math.max(items.length - 1, 0));

  // Call with the textarea after every change or caret move.
  // Until the database has mentions (supabase/mentions.sql), "@" says they're coming instead of doing nothing.
  const track = (el: HTMLTextAreaElement) => {
    const found = el.selectionStart === el.selectionEnd ? mentionQuery(el.value, el.selectionStart) : null;
    setQuery(found);
    if (!found) setPeople([]);
  };
  const close = () => { seq.current++; setQuery(null); setPeople([]); };

  const pick = (item: Item) => {
    const el = ref.current;
    if (!el || !query) return;
    const name = item.kind === "project" ? item.p.title : `${item.p.first} ${item.p.last}`.trim();
    const caret = el.selectionStart;
    setText(`${text.slice(0, query.start)}@${name} ${text.slice(caret)}`);
    if (item.kind === "project") onProject?.(item.p);
    else { const id = item.p.id; setPicked((cur) => (cur.some((m) => m.id === id) ? cur : [...cur, { id, name }])); }
    close();
    const at = query.start + name.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at, at); });
  };

  const open = query !== null && items.length > 0;
  const soon = query !== null && !enabled && !projectHits.length;
  // Returns true when the key was for the menu.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (soon && e.key === "Escape") { e.preventDefault(); close(); return true; }
    if (!open) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive((current + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length); return true; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(items[current]); return true; }
    if (e.key === "Escape") { e.preventDefault(); close(); return true; }
    return false;
  };

  return {
    mentions: keepMentioned(text, picked),
    reset: () => { setPicked([]); close(); },
    track,
    onKeyDown,
    close,
    // No aria-expanded: it isn't valid on a plain text box (the composer), and screen readers get the
    // same signal from aria-controls appearing while the list is open.
    inputProps: { "aria-autocomplete": "list" as const, "aria-controls": open ? listId : undefined, "aria-activedescendant": open ? `${listId}-${current}` : undefined },
    menu: open ? <MentionMenu id={listId} items={items} active={current} onHover={setActive} onPick={pick} people={enabled} /> : soon ? (
      <div role="status" className="absolute inset-x-0 top-full z-40 mt-2 flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-xs text-muted shadow-[var(--shadow)]"><AtSign className="size-3.5" /> @mentions are switching on soon.</div>
    ) : null,
  };
}

function MentionMenu({ id, items, active, onHover, onPick, people }: { id: string; items: Item[]; active: number; onHover: (i: number) => void; onPick: (item: Item) => void; people: boolean }) {
  const hasProjects = items.some((x) => x.kind === "project");
  // Opening near the bottom of the screen (or above a phone's keyboard): scroll just enough to show it.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, []);
  return (
    <div ref={box} className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] text-faint">
        <AtSign className="size-3" /> {hasProjects && people ? "Link one of your projects, or mention someone." : hasProjects ? "Link one of your projects." : "Mention someone. They'll get a notification."}
      </div>
      <ul id={id} role="listbox" aria-label={hasProjects ? "Projects and people" : "People to mention"} className="max-h-72 overflow-y-auto p-1">
        {items.map((item, i) => (
          <li key={`${item.kind}-${item.p.id}`} id={`${id}-${i}`} role="option" aria-selected={i === active}
            // mousedown, not click: keeps the textarea focused so the caret position is still known.
            onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
            onMouseEnter={() => onHover(i)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2", i === active && "bg-hover")}>
            {item.kind === "project" ? (
              <>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2"><FolderGit2 className="size-4 text-muted" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.p.title}</span>
                  <span className="block truncate text-xs text-muted">Your project · links this post to it</span>
                </span>
              </>
            ) : (
              <>
                <Avatar first={item.p.first} last={item.p.last} size={32} src={item.p.avatar} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.p.first} {item.p.last}</span>
                  {item.p.headline && <span className="block truncate text-xs text-muted">{item.p.headline}</span>}
                </span>
                {item.p.follows && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">Following</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
