// Messages: your conversations on the left, the open one on the right. #/messages and #/messages/<id>.
// On narrow screens only one side shows at a time.
import { live } from "../supabase.js";
import { esc, initials, timeAgo, friendlyError, toast, ms } from "../util.js";
import { conversations, thread, send, accept, decline, blockAndReport, markRead, messageSettings } from "../messages.js";

export function render({ view, state, params, navigate }) {
  const me = state.user.uid;
  const cid = params[0] || "";
  let convs = null, tab = "inbox", msgs = null, tabChosen = false, requestsOn = true;

  view.innerHTML = `
    <div class="page" style="max-width:1100px">
      <div class="card msg-wrap" data-open="${cid ? "thread" : "list"}">
        <aside class="msg-list-pane">
          <div class="msg-list-head">
            <div class="row" style="justify-content:space-between;flex-wrap:nowrap">
              <h1 style="font-size:22px">Messages</h1>
              <a class="btn ghost" href="#/settings/messaging" aria-label="Message settings" title="Message settings" style="min-height:36px;padding:0 8px">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M10 12.5 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z M10 2 V4 M10 16 V18 M2 10 H4 M16 10 H18 M4.3 4.3 L5.7 5.7 M14.3 14.3 L15.7 15.7 M4.3 15.7 L5.7 14.3 M14.3 5.7 L15.7 4.3"></path></svg>
              </a>
            </div>
            <div class="tabs" role="tablist" aria-label="Messages">
              <button class="tab" role="tab" data-tab="inbox" aria-selected="true">Inbox<span class="tab-count" data-count="inbox"></span></button>
              <button class="tab" role="tab" data-tab="unread" aria-selected="false">Unread</button>
              <button class="tab" role="tab" data-tab="requests" aria-selected="false">Requests<span class="tab-count" data-count="requests"></span></button>
            </div>
          </div>
          <div class="msg-list" id="m-list">${skeletonRows()}</div>
        </aside>
        <section class="msg-thread-pane" id="m-thread">
          ${cid ? `<div class="msg-thread-head" id="m-head"><div class="skeleton" style="height:36px;width:220px"></div></div>
            <div class="msg-scroll" id="m-scroll"><div class="msg-day small faint">Loading…</div></div>
            <div id="m-foot"></div>`
          : `<div class="msg-empty stack"><h2 style="font-size:18px">Your conversations</h2>
            <p class="muted small">Pick a conversation, or start one with the <strong>Message</strong> button on someone's profile or in your <a href="#/network/connections">connections</a>.</p>
            <p class="faint small">Messages from people you're not connected with arrive as requests, so your inbox stays yours.</p></div>`}
        </section>
      </div>
    </div>`;

  const listEl = view.querySelector("#m-list");
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; tabChosen = true; drawList(); });

  const isRequestToMe = c => c.status === "request" && !c.startedByMe;
  const current = () => (convs || []).find(c => c.id === cid);

  function drawList() {
    if (!convs) return;
    // With the request inbox off, requests stay in the Inbox, marked "Not connected".
    const requests = convs.filter(isRequestToMe), inbox = requestsOn ? convs.filter(c => !isRequestToMe(c)) : convs;
    const unread = inbox.filter(c => c.unread);
    if (!requestsOn && tab === "requests") tab = "inbox";
    const setCount = (k, n) => { const el = view.querySelector(`[data-count="${k}"]`); if (el) el.textContent = n ? ` ${n}` : ""; };
    setCount("inbox", unread.length); setCount("requests", requests.length);
    view.querySelector(`[data-tab="requests"]`).style.display = requestsOn ? "" : "none";
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === tab)));
    const shown = tab === "requests" ? requests : tab === "unread" ? unread : inbox;
    const note = tab === "requests" ? `<p class="small muted msg-list-note">People you're not connected with land here first. They can't see that you've read their message until you accept.</p>` : "";
    listEl.innerHTML = note + (shown.length ? shown.map(c => `
      <a class="msg-row${c.id === cid ? " active" : ""}${c.unread ? " unread" : ""}" href="#/messages/${esc(c.id)}">
        <span class="avatar md">${esc(initials(c.other.firstName, c.other.lastName))}</span>
        <span class="msg-row-text">
          <span class="row" style="gap:8px;flex-wrap:nowrap;justify-content:space-between">
            <strong class="msg-name">${esc(c.other.firstName)} ${esc(c.other.lastName)}</strong>
            <span class="small faint" style="flex:none">${c.lastAt ? esc(timeAgo(c.lastAt)) : ""}</span>
          </span>
          <span class="small ${c.unread ? "" : "muted"} msg-preview">${c.status === "request" && c.startedByMe ? `<span class="faint">Request sent · </span>` : ""}${isRequestToMe(c) && !requestsOn ? `<span class="faint">Not connected · </span>` : ""}${c.lastFromMe ? "You: " : ""}${esc(c.lastBody || "No messages yet")}</span>
        </span>
        ${c.unread ? `<span class="msg-dot" aria-label="Unread"></span>` : ""}
      </a>`).join("")
      : `<p class="muted small" style="padding:20px">${tab === "requests"
        ? "No message requests. You're all caught up."
        : tab === "unread" ? "No unread messages."
        : "No conversations yet. Use <strong>Message</strong> on a profile or connection to start one."}</p>`);
  }

  // ---------- The open conversation ----------

  function drawHead() {
    const head = view.querySelector("#m-head"); if (!head) return;
    const c = current();
    if (!c) {
      view.querySelector("#m-thread").innerHTML = `<div class="msg-empty stack"><h2 style="font-size:18px">Conversation not found</h2>
        <p class="muted small">It may have been declined or removed.</p><a class="btn" href="#/messages">Back to messages</a></div>`;
      return;
    }
    head.innerHTML = `
      <a href="#/messages" class="btn ghost msg-back" aria-label="Back to all messages">←</a>
      <a class="avatar sm" href="#/u/${esc(c.other.id)}">${esc(initials(c.other.firstName, c.other.lastName))}</a>
      <span style="display:flex;flex-direction:column;min-width:0">
        <a href="#/u/${esc(c.other.id)}" style="font-weight:600;text-decoration:none">${esc(c.other.firstName)} ${esc(c.other.lastName)}</a>
        <span class="small faint msg-preview">${esc(c.other.headline || "")}</span>
      </span>`;
    drawFoot(c);
  }

  let footState = "";
  function drawFoot(c) {
    const foot = view.querySelector("#m-foot"); if (!foot) return;
    // Only the person who started a request can send in it, so a preview means their one message has gone.
    const mode = isRequestToMe(c) ? "incoming" : c.status === "request" ? (c.lastAt ? "sent" : "outgoing") : "open";
    if (mode === footState) return; // keep whatever is being typed
    footState = mode;
    const name = esc(c.other.firstName);
    if (mode === "incoming") {
      foot.innerHTML = `<div class="msg-request stack">
        <p><strong>${name} wants to message you.</strong> <span class="muted">Accept to reply. Until then, ${name} can't send more messages or see that you've read this.</span></p>
        <div class="row" style="gap:8px"><button class="btn primary" id="m-accept">Accept</button><button class="btn" id="m-decline">Decline</button><button class="btn ghost" id="m-block" style="color:var(--warn)">Block &amp; report</button></div></div>`;
      foot.querySelector("#m-block").onclick = async e => {
        if (e.target.dataset.confirm !== "1") { e.target.dataset.confirm = "1"; e.target.textContent = "Click again to block and report"; return; }
        e.target.disabled = true;
        try { await blockAndReport(c.id); toast(`${name} is blocked and can't message you again. Forge has your report.`); navigate("messages"); }
        catch (err) { toast(esc(friendlyError(err))); e.target.disabled = false; }
      };
      foot.querySelector("#m-accept").onclick = async e => {
        e.target.disabled = true;
        try { await accept(c.id); toast(`You can now message <strong>${name}</strong>.`); }
        catch (err) { toast(esc(friendlyError(err))); e.target.disabled = false; }
      };
      foot.querySelector("#m-decline").onclick = async e => {
        if (e.target.dataset.confirm !== "1") { e.target.dataset.confirm = "1"; e.target.textContent = "Click again to decline"; return; }
        e.target.disabled = true;
        try { await decline(c.id); toast("Request declined."); navigate("messages"); }
        catch (err) { toast(esc(friendlyError(err))); e.target.disabled = false; }
      };
      return;
    }
    if (mode === "sent") {
      foot.innerHTML = `<p class="msg-request small muted">Your message request was sent. You can send more once ${name} accepts it or you connect.</p>`;
      return;
    }
    foot.innerHTML = `
      ${mode === "outgoing" ? `<p class="small faint" style="padding:0 18px">${name} will see this as a message request. You can send one message until they accept or you connect.</p>` : ""}
      <form class="msg-compose" id="m-form">
        <label class="sr-only" for="m-input">Write a message</label>
        <textarea id="m-input" class="input" rows="1" maxlength="2000" placeholder="Write a message"></textarea>
        <button class="btn primary" id="m-send">Send</button>
      </form>`;
    const form = foot.querySelector("#m-form"), input = foot.querySelector("#m-input"), btn = foot.querySelector("#m-send");
    const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; };
    input.addEventListener("input", grow);
    // Enter sends; Shift+Enter starts a new line.
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      btn.disabled = true;
      try { await send(c.id, text); input.value = ""; grow(); }
      catch (err) { toast(esc(friendlyError(err))); }
      btn.disabled = false; input.focus();
    };
    if (window.matchMedia("(min-width: 800px)").matches) input.focus();
  }

  function drawMessages() {
    const box = view.querySelector("#m-scroll"); if (!box || !msgs) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    let lastDay = "";
    box.innerHTML = msgs.length ? msgs.map((m, i) => {
      const day = dayLabel(m.createdAt);
      const prev = msgs[i - 1];
      const grouped = prev && prev.senderId === m.senderId && ms(m.createdAt) - ms(prev.createdAt) < 5 * 60000 && day === lastDay;
      const sep = day !== lastDay ? `<div class="msg-day small faint">${esc(day)}</div>` : "";
      lastDay = day;
      return `${sep}<div class="msg ${m.senderId === me ? "mine" : "theirs"}${grouped ? " grouped" : ""}">
        <p class="msg-bubble">${esc(m.body)}</p>
        ${grouped ? "" : `<span class="msg-time faint">${esc(clock(m.createdAt))}</span>`}</div>`;
    }).join("") : `<div class="msg-day small faint">No messages yet. Say hello.</div>`;
    if (nearBottom || !box.dataset.ready) { box.scrollTop = box.scrollHeight; box.dataset.ready = "1"; }
  }

  // Marks the conversation read when you're looking at it.
  let readTimer = null;
  const markSeen = () => {
    const c = current();
    // A request stays unread until you accept it, as in the prototype.
    if (!c || !c.unread || isRequestToMe(c) || document.hidden) return;
    clearTimeout(readTimer);
    readTimer = setTimeout(() => markRead(cid).catch(() => {}), 400);
  };
  const onVisible = () => { if (!document.hidden) markSeen(); };
  document.addEventListener("visibilitychange", onVisible);

  // ---------- Live data ----------

  messageSettings(me).then(s => { requestsOn = s.requestsOn; drawList(); }).catch(() => {});

  const stopList = live(["conversations", "conversation_reads"], () => conversations(me), data => {
    convs = data;
    if (!tabChosen && cid) { const c = current(); if (c && isRequestToMe(c) && requestsOn) tab = "requests"; }
    drawList();
    if (cid) { drawHead(); markSeen(); }
  }, err => { listEl.innerHTML = `<p class="error" style="padding:20px">${esc(friendlyError(err))}</p>`; });

  const stopThread = cid ? live(["messages"], () => thread(cid), data => {
    msgs = data;
    drawMessages();
    const c = current(); if (c) drawFoot(c);
    markSeen();
  }, err => { const box = view.querySelector("#m-scroll"); if (box) box.innerHTML = `<p class="error">${esc(friendlyError(err))}</p>`; }) : () => {};

  return () => { stopList(); stopThread(); clearTimeout(readTimer); document.removeEventListener("visibilitychange", onVisible); };
}

function dayLabel(ts) {
  const d = new Date(ts), today = new Date();
  const start = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: diff < 7 ? "long" : undefined, month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
const clock = ts => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function skeletonRows() {
  return Array.from({ length: 3 }, () => `<div class="msg-row" aria-hidden="true"><div class="skeleton" style="width:44px;height:44px;border-radius:50%"></div><div class="stack" style="gap:6px;flex:1"><div class="skeleton" style="height:12px;width:50%"></div><div class="skeleton" style="height:10px;width:80%"></div></div></div>`).join("");
}
