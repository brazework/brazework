// No "use client": a hook for client components (the composer), bundled with them.
import { AtSign } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { keepMentioned, mentionQuery, type Mention } from "@/lib/mention-text";
import { mentionSuggestions, type MentionPerson } from "@/lib/mentions";

// @mention autocomplete for a textarea: type "@" and a name, pick with the arrow keys and Enter
// (or Tab, or a click), and "@First Last" goes into the text. `mentions` is what to send with the
// post: everyone picked whose name is still in the text.
export function useMentions({ text, setText, ref, enabled, suggest = mentionSuggestions }: { text: string; setText: (v: string) => void; ref: RefObject<HTMLTextAreaElement | null>; enabled: boolean; suggest?: (q: string) => Promise<MentionPerson[]> }) {
  const [picked, setPicked] = useState<Mention[]>([]);
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [people, setPeople] = useState<MentionPerson[]>([]);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const listId = useId();

  const q = query?.q ?? null;
  useEffect(() => {
    if (q === null) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const found = await suggest(q).catch(() => []);
      if (mine === seq.current) { setPeople(found); setActive(0); }
    }, 120);
    return () => clearTimeout(t);
  }, [q, suggest]);

  // Call with the textarea after every change or caret move.
  const track = (el: HTMLTextAreaElement) => {
    if (!enabled) return;
    const found = el.selectionStart === el.selectionEnd ? mentionQuery(el.value, el.selectionStart) : null;
    setQuery(found);
    if (!found) setPeople([]);
  };
  const close = () => { seq.current++; setQuery(null); setPeople([]); };

  const pick = (p: MentionPerson) => {
    const el = ref.current;
    if (!el || !query) return;
    const name = `${p.first} ${p.last}`.trim();
    const caret = el.selectionStart;
    const next = `${text.slice(0, query.start)}@${name} ${text.slice(caret)}`;
    setText(next);
    setPicked((cur) => (cur.some((m) => m.id === p.id) ? cur : [...cur, { id: p.id, name }]));
    close();
    const at = query.start + name.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at, at); });
  };

  const open = query !== null && people.length > 0;
  // Returns true when the key was for the menu.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i + (e.key === "ArrowDown" ? 1 : people.length - 1)) % people.length); return true; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(people[active]); return true; }
    if (e.key === "Escape") { e.preventDefault(); close(); return true; }
    return false;
  };

  return {
    mentions: keepMentioned(text, picked),
    reset: () => { setPicked([]); close(); },
    track,
    onKeyDown,
    close,
    inputProps: { "aria-autocomplete": "list" as const, "aria-expanded": open, "aria-controls": open ? listId : undefined, "aria-activedescendant": open ? `${listId}-${active}` : undefined },
    menu: open ? <MentionMenu id={listId} people={people} active={active} onHover={setActive} onPick={pick} /> : null,
  };
}

function MentionMenu({ id, people, active, onHover, onPick }: { id: string; people: MentionPerson[]; active: number; onHover: (i: number) => void; onPick: (p: MentionPerson) => void }) {
  return (
    <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] text-faint"><AtSign className="size-3" /> Mention someone. They&apos;ll get a notification.</div>
      <ul id={id} role="listbox" aria-label="People to mention" className="max-h-72 overflow-y-auto p-1">
        {people.map((p, i) => (
          <li key={p.id} id={`${id}-${i}`} role="option" aria-selected={i === active}
            // mousedown, not click: keeps the textarea focused so the caret position is still known.
            onMouseDown={(e) => { e.preventDefault(); onPick(p); }}
            onMouseEnter={() => onHover(i)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2", i === active && "bg-hover")}>
            <Avatar first={p.first} last={p.last} size={32} src={p.avatar} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.first} {p.last}</span>
              {p.headline && <span className="block truncate text-xs text-muted">{p.headline}</span>}
            </span>
            {p.follows && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">Following</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
