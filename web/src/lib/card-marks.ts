import type { ReplyPreview } from "@/app/(app)/feed/post-card";

// What you did to a post card this session (Linear FIX-77): liked, saved, replied, edited, deleted.
// The feed is virtualized, so a card that scrolls far away unmounts and its React state goes; this
// keeps your actions so it comes back as you left it, without asking the server to re-render the feed.
// Your actions are already saved in the database, so a fresh page agrees with these.
export type Mark = { liked?: boolean; saved?: boolean; replies?: ReplyPreview[]; edited?: { body: string; tags: string[] }; gone?: boolean; seen?: boolean };
const marks = new Map<string, Mark>();

export const cardMark = (id: string): Mark => marks.get(id) ?? {};
export const markCard = (id: string, patch: Mark) => { marks.set(id, { ...marks.get(id), ...patch }); };
