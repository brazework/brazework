// Messages: one-to-one conversations. Connections land in the Inbox; anyone else starts as a request.
// The database decides the status, keeps the preview and unread markers, and enforces who can write.
import { sb, run, rows, many } from "./supabase.js";

const MAX_REQUEST_MESSAGES = 3;
export { MAX_REQUEST_MESSAGES };

// A conversation as seen by you: who the other person is, and whether you have unread messages.
function view(c, me) {
  const mineIsA = c.userA === me;
  const otherId = mineIsA ? c.userB : c.userA;
  const readAt = Date.parse(mineIsA ? c.aReadAt : c.bReadAt) || 0;
  const lastAt = Date.parse(c.lastMessageAt) || 0;
  return {
    id: c.id, status: c.status, startedByMe: c.startedBy === me,
    other: { id: otherId, ...((c.people || {})[otherId] || {}) },
    lastBody: c.lastBody || "", lastAt: c.lastMessageAt, lastFromMe: c.lastSender === me,
    unread: !!lastAt && c.lastSender !== me && lastAt > readAt
  };
}

// Your conversations, newest activity first. Empty ones you didn't start are left out.
export async function conversations(me) {
  const list = rows(await run(sb.from("conversations").select("*")
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("last_message_at", { ascending: false, nullsFirst: false }).limit(200)));
  return list.map(c => view(c, me)).filter(c => c.lastAt || c.startedByMe);
}

export const thread = cid => many(sb.from("messages").select("*").eq("conversation_id", cid)
  .order("created_at", { ascending: true }).limit(300));

export const send = (cid, body) => run(sb.from("messages").insert({ conversation_id: cid, body }));
export const start = otherId => run(sb.rpc("start_conversation", { p_other: otherId }));
export const accept = cid => run(sb.rpc("accept_conversation", { p_cid: cid }));
export const decline = cid => run(sb.from("conversations").delete().eq("id", cid));
export const markRead = cid => run(sb.rpc("mark_conversation_read", { p_cid: cid }));
export async function unreadCount() {
  try { return Number(await run(sb.rpc("unread_conversations"))) || 0; } catch (e) { return 0; }
}
