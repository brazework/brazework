// Notifications: likes, comments, follows, connection requests and community joins.
// Opening the page marks everything read; what was new stays highlighted until you leave.
import { live } from "../supabase.js";
import { esc, initials, timeAgo, friendlyError, toast, icon } from "../util.js";
import { notifications, markAllRead, clearNotification } from "../activity.js";

const name = n => `<strong>${esc(`${n.actorFirst} ${n.actorLast}`.trim() || "Someone")}</strong>`;
const others = (lead, rest) => rest ? `${lead} and ${rest} ${rest === 1 ? "other" : "others"}` : lead;

// Several likes on one post, or several new followers, read as one line.
function group(list) {
  const out = [], byKey = new Map();
  list.forEach(n => {
    const key = n.kind === "like" ? "like:" + n.postId : n.kind === "follow" ? "follow" : null;
    if (key && byKey.has(key)) { byKey.get(key).items.push(n); return; }
    const g = { key: key || "n" + n.id, items: [n] };
    if (key) byKey.set(key, g);
    out.push(g);
  });
  return out;
}

function describe(g) {
  const n = g.items[0], rest = g.items.length - 1;
  const where = n.communityName ? ` in <strong>${esc(n.communityName)}</strong>` : "";
  switch (n.kind) {
    case "like": return { ic: "heart", href: `#/post/${n.postId}`, text: `${others(name(n), rest)} liked your post${where}`, quote: n.snippet };
    case "comment": return { ic: "comment", href: `#/post/${n.postId}`, text: `${name(n)} commented on your post${where}`, quote: n.snippet };
    case "follow": return { ic: "user", href: rest ? "#/network/followers" : `#/u/${n.actorId}`, text: `${others(name(n), rest)} started following you` };
    case "connect_request": return { ic: "network", href: "#/network/invitations", text: `${name(n)} wants to connect`, cta: "Respond" };
    case "connect_accepted": return { ic: "network", href: `#/u/${n.actorId}`, text: `${name(n)} accepted your connection request` };
    case "community_request": return { ic: "groups", href: `#/c/${n.communityId}/manage`, text: `${name(n)} asked to join <strong>${esc(n.communityName)}</strong>`, cta: "Review" };
    case "community_approved": return { ic: "groups", href: `#/c/${n.communityId}`, text: `You're in: your request to join <strong>${esc(n.communityName)}</strong> was approved` };
    default: return { ic: "bell", href: "#/notifications", text: "Something new happened" };
  }
}

export function render({ view, state }) {
  const me = state.user.uid;
  let list = null, error = "", tab = "all", markTimer = null;
  const fresh = new Set(); // unread when you opened the page

  view.innerHTML = `
    <div class="page" style="max-width:760px">
      <div class="stack" style="gap:6px;margin-bottom:16px">
        <div class="kicker">Notifications</div>
        <h1 style="font-size:28px">What's new</h1>
      </div>
      <div class="tabs" role="tablist" aria-label="Show">
        <button class="tab" role="tab" data-tab="all" aria-selected="true">All</button>
        <button class="tab" role="tab" data-tab="unread" aria-selected="false">New<span class="tab-count" id="nt-new"></span></button>
      </div>
      <div id="nt-list" class="stack" style="gap:0;margin-top:12px" aria-live="polite"></div>
    </div>`;
  const box = view.querySelector("#nt-list");

  const draw = () => {
    view.querySelector("#nt-new").textContent = fresh.size ? " " + fresh.size : "";
    if (error) { box.innerHTML = `<div class="card"><p class="error">${esc(error)}</p></div>`; return; }
    if (!list) { box.innerHTML = Array.from({ length: 4 }, () => `<div class="skeleton" style="height:68px;margin-bottom:8px;border-radius:10px"></div>`).join(""); return; }
    const shown = group(tab === "unread" ? list.filter(n => fresh.has(n.id)) : list);
    if (!shown.length) {
      box.innerHTML = `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${tab === "unread"
        ? "Nothing new since you last looked."
        : "No notifications yet. When people like or comment on your posts, follow you or want to connect, you'll see it here."}</p></div>`;
      return;
    }
    box.innerHTML = shown.map(g => {
      const d = describe(g), n = g.items[0], isNew = g.items.some(x => fresh.has(x.id));
      return `<div class="notif${isNew ? " is-new" : ""}">
        <a class="notif-main" href="${esc(d.href)}">
          <span class="avatar md" aria-hidden="true">${esc(initials(n.actorFirst, n.actorLast))}</span>
          <span class="notif-ic" aria-hidden="true">${icon(d.ic, 14)}</span>
          <span class="stack" style="gap:2px;min-width:0;flex:1">
            <span>${isNew ? `<span class="sr-only">New: </span>` : ""}${d.text}</span>
            ${d.quote ? `<span class="small muted notif-quote">“${esc(d.quote)}”</span>` : ""}
            <span class="small faint">${esc(timeAgo(n.createdAt))}${d.cta ? ` · <span style="color:var(--accent)">${d.cta}</span>` : ""}</span>
          </span>
        </a>
        <button class="btn ghost notif-x" data-clear="${g.items.map(x => x.id).join(",")}" aria-label="Remove this notification">×</button>
      </div>`;
    }).join("");
    box.querySelectorAll("[data-clear]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await Promise.all(b.dataset.clear.split(",").map(id => clearNotification(Number(id)))); }
      catch (e) { b.disabled = false; toast(esc(friendlyError(e))); }
    });
  };

  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    draw();
  });

  draw();
  const unsub = live(["notifications"], () => notifications(me), rows => {
    list = rows; error = "";
    const unread = rows.filter(n => !n.read);
    unread.forEach(n => fresh.add(n.id));
    draw();
    // Mark read once you've had a moment to see them.
    if (unread.length) {
      clearTimeout(markTimer);
      markTimer = setTimeout(() => { markTimer = null; markAllRead().catch(() => {}); }, 1200);
    }
  }, e => { error = friendlyError(e); draw(); });

  return () => {
    if (markTimer) { clearTimeout(markTimer); markAllRead().catch(() => {}); }
    unsub();
  };
}
