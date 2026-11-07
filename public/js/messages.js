// Messages: one-to-one conversations. Connections land in the Inbox; anyone else starts as a request.
// The database decides the status, keeps the preview and unread markers, and enforces who can write.
import { sb, run, rows, many, one } from "./supabase.js";

// A conversation as seen by you: who the other person is, and whether you have unread messages.
function view(c, me, readAt) {
  const otherId = c.userA === me ? c.userB : c.userA;
  const lastAt = Date.parse(c.lastMessageAt) || 0;
  return {
    id: c.id, status: c.status, startedByMe: c.startedBy === me,
    other: { id: otherId, ...((c.people || {})[otherId] || {}) },
    lastBody: c.lastBody || "", lastAt: c.lastMessageAt, lastFromMe: c.lastSender === me,
    unread: !!lastAt && c.lastSender !== me && lastAt > (Date.parse(readAt) || 0)
  };
}

// Your conversations, newest activity first. Empty ones you didn't start are left out.
export async function conversations(me) {
  const [list, reads] = await Promise.all([
    many(sb.from("conversations").select("*")
      .or(`user_a.eq.${me},user_b.eq.${me}`)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(200)),
    many(sb.from("conversation_reads").select("conversation_id, read_at").eq("user_id", me))
  ]);
  const readAt = new Map(reads.map(r => [r.conversationId, r.readAt]));
  return list.map(c => view(c, me, readAt.get(c.id))).filter(c => c.lastAt || c.startedByMe);
}

export const thread = cid => many(sb.from("messages").select("*").eq("conversation_id", cid)
  .order("created_at", { ascending: true }).limit(300));

export const send = (cid, body) => run(sb.from("messages").insert({ conversation_id: cid, body }));
export const start = otherId => run(sb.rpc("start_conversation", { p_other: otherId }));
export const accept = cid => run(sb.rpc("accept_conversation", { p_cid: cid }));
export const decline = cid => run(sb.from("conversations").delete().eq("id", cid));
export const blockAndReport = cid => run(sb.rpc("block_and_report", { p_cid: cid }));
export const markRead = cid => run(sb.rpc("mark_conversation_read", { p_cid: cid }));
export async function unreadCount() {
  try { return Number(await run(sb.rpc("unread_conversations"))) || 0; } catch (e) { return 0; }
}

// Your messaging settings. With nothing saved yet, requests are on and anyone can message you.
export async function messageSettings(me) {
  const s = await one(sb.from("message_settings").select("requests_on, who_can_message").eq("user_id", me));
  return { requestsOn: s ? s.requestsOn : true, whoCanMessage: s ? s.whoCanMessage : "everyone" };
}
export const saveMessageSettings = ({ requestsOn, whoCanMessage }) =>
  run(sb.rpc("save_message_settings", { p_requests_on: requestsOn, p_who: whoCanMessage }));

// The people you've blocked, with their names.
export async function blockedPeople(me) {
  const ids = rows(await run(sb.from("message_blocks").select("blocked").eq("blocker", me)
    .order("created_at", { ascending: false }))).map(b => b.blocked);
  if (!ids.length) return [];
  const people = await many(sb.from("profiles").select("id, first_name, last_name").in("id", ids));
  return ids.map(id => people.find(p => p.id === id) || { id, firstName: "Former", lastName: "member" });
}
export const unblock = (me, otherId) => run(sb.from("message_blocks").delete().eq("blocker", me).eq("blocked", otherId));
