// One community: its posts, members and rules. #/c/<id>, and #/c/<id>/manage for moderators.
import { live } from "../supabase.js";
import { esc, initials, friendlyError, timeAgo } from "../util.js";
import { composerHTML, bindComposer, createPostList, skeletonPosts } from "../posts.js";
import {
  getCommunity, getMembership, hasRequested, runJoinAction, badge, fmtCount, membersLabel, tint, autoModVerdict,
  PRIVACY_LABEL, TYPE_LABEL, ROLE_LABEL, PERMS, rank, can, rolesTable, visiblePosts, heldPosts, members
} from "../communities.js";
import * as manage from "./community-manage.js";

export async function render(ctx) {
  const { view, state, params, navigate } = ctx;
  const cid = params[0];
  const uid = state.user.uid;
  view.innerHTML = `<div class="page"><div class="skeleton" style="height:200px;border-radius:14px"></div><div style="height:16px"></div>${skeletonPosts(2)}</div>`;

  let c = null, me = null, requested = false;
  try {
    c = cid ? await getCommunity(cid) : null;
    if (c) [me, requested] = await Promise.all([getMembership(cid, uid), hasRequested(cid, uid)]);
  } catch (e) {
    view.innerHTML = `<div class="page"><div class="card"><p class="error">${esc(friendlyError(e))}</p></div></div>`; return;
  }
  if (!c) {
    view.innerHTML = `<div class="page"><div class="card stack"><h1 style="font-size:22px">Community not found</h1><p class="muted">It may have been removed.</p><a class="btn" href="#/communities">Back to communities</a></div></div>`;
    return;
  }

  if (params[1] === "manage") return manage.render({ ...ctx, c, me });

  const myRank = rank(me && me.role);
  const canView = c.privacy === "public" || !!me;
  const reload = () => navigate(`c/${cid}`);

  view.innerHTML = `
    <div class="page stack" style="gap:24px">
      <a href="#/communities" class="small muted" style="text-decoration:none">← All communities</a>
      <section class="card" style="padding:0;overflow:hidden">
        <div class="c-banner" style="--tint:${tint(c.id)}"></div>
        <div class="row" style="padding:0 28px 24px;align-items:flex-end;gap:20px">
          <span style="margin-top:-44px;border:5px solid var(--surface);border-radius:20px;display:inline-flex">${badge(c, 88)}</span>
          <div class="stack" style="gap:4px;flex:1 1 320px;padding-top:12px">
            <div class="row" style="gap:10px"><h1 style="font-size:28px">${esc(c.name)}</h1>${me ? `<span class="role-chip role-${esc(me.role)}">${esc(ROLE_LABEL[me.role])}</span>` : ""}</div>
            <span class="muted">${membersLabel(c.memberCount)} · ${esc(PRIVACY_LABEL[c.privacy] || "")} · ${esc(c.field || "")} · ${esc(TYPE_LABEL[c.type] || "")}</span>
            ${(c.topics || []).length ? `<div class="row" style="gap:6px;margin-top:6px">${c.topics.map(t => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="row" style="gap:8px">
            ${myRank >= 2 ? `<a class="btn" href="#/c/${esc(cid)}/manage">Manage</a>` : ""}
            <button class="btn ${me ? "" : requested ? "" : "primary"}" id="c-join" data-state="${requested ? "requested" : ""}">${me ? (me.role === "owner" ? "You own this" : "Leave") : requested ? "Requested · withdraw" : c.privacy === "public" ? "Join community" : "Request to join"}</button>
          </div>
        </div>
      </section>
      <div class="cols">
        <section class="col-main">
          <div class="tabs" role="tablist" aria-label="Community">
            <button class="tab" role="tab" aria-selected="true" data-tab="posts">Posts</button>
            <button class="tab" role="tab" aria-selected="false" data-tab="members">Members</button>
            <button class="tab" role="tab" aria-selected="false" data-tab="about">About</button>
          </div>
          <div id="c-pane" class="stack" style="gap:16px"></div>
        </section>
        <aside class="col-right">
          <section class="card stack">
            <h2 style="font-size:16px">About</h2>
            <p class="small muted" style="white-space:pre-wrap">${esc(c.about || "")}</p>
            <span class="small faint">Started by ${esc(c.ownerName || "a member")}${c.createdAt ? ` · ${esc(timeAgo(c.createdAt))}` : ""}</span>
          </section>
          ${c.rules ? `<section class="card stack"><h2 style="font-size:16px">Community rules</h2><p class="small muted" style="white-space:pre-wrap">${esc(c.rules)}</p></section>` : ""}
          ${me ? `<section class="card stack"><h2 style="font-size:16px">Your role: ${esc(ROLE_LABEL[me.role])}</h2>
            <ul class="brief-list">${PERMS.filter(([k]) => can(me.role, k)).map(([, l]) => `<li><span class="brief-k">✓</span><span class="small">${esc(l)}</span></li>`).join("") || `<li><span class="small muted">Post, comment and take part.</span></li>`}</ul></section>` : ""}
        </aside>
      </div>
    </div>`;

  const joinBtn = view.querySelector("#c-join");
  if (me && me.role === "owner") joinBtn.disabled = true;
  joinBtn.onclick = () => runJoinAction(joinBtn, c, state, me, reload);

  const pane = view.querySelector("#c-pane");
  let stop = null;
  const show = t => {
    if (stop) { stop(); stop = null; }
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === t)));
    if (t === "posts") stop = drawPosts();
    if (t === "members") drawMembers();
    if (t === "about") drawAbout();
  };
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));

  function drawPosts() {
    if (!canView) {
      pane.innerHTML = `<div class="card stack" style="text-align:center;align-items:center;padding:40px;border-style:dashed">
        <h2 style="font-size:18px">Posts are for members</h2>
        <p class="muted">${requested ? "Your request is in. A moderator will review it soon." : "Request to join and a moderator will review it."}</p></div>`;
      return null;
    }
    pane.innerHTML = `
      ${me ? composerHTML(state.profile, { placeholder: `Share something with ${c.name}` }) : `<div class="card row" style="justify-content:space-between"><span class="muted">Join to post and comment here.</span></div>`}
      <div id="c-held"></div>
      <div id="c-posts" class="stack" style="gap:16px">${skeletonPosts(2)}</div>`;
    if (me) bindComposer(pane.querySelector("[data-composer]"), state, {
      communityId: cid,
      decide: text => autoModVerdict(c, me, text)
    });
    const listEl = pane.querySelector("#c-posts");
    const list = createPostList(listEl, {
      state,
      modFor: () => myRank >= 3,
      canComment: () => !!me,
      empty: `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">No posts yet. ${me ? "Start the first conversation above." : ""}</p></div>`
    });
    const un = live(["posts"], () => visiblePosts([cid], 50), posts => list.update(posts),
      err => { listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
    let unHeld = () => {};
    if (myRank >= 3) {
      unHeld = live(["posts"], () => heldPosts(cid), held => {
        const el = pane.querySelector("#c-held"); if (!el) return;
        const n = held.length;
        el.innerHTML = n ? `<a class="card row" href="#/c/${esc(cid)}/manage" style="justify-content:space-between;text-decoration:none;border-color:var(--accent)"><span><strong>${n}</strong> ${n === 1 ? "post is" : "posts are"} waiting for review</span><span class="small" style="color:var(--accent)">Review →</span></a>` : "";
      }, () => {});
    }
    return () => { un(); unHeld(); list.destroy(); };
  }

  async function drawMembers() {
    pane.innerHTML = skeletonPosts(1);
    try {
      const list = await members(cid, 300);
      const ms = list.sort((a, b) => rank(b.role) - rank(a.role) || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      pane.innerHTML = `<div class="card stack" style="gap:0;padding:8px 0">${ms.map(m => `
        <a href="#/u/${esc(m.uid)}" class="member-row">
          <span class="avatar sm">${esc(initials(m.firstName, m.lastName))}</span>
          <span style="display:flex;flex-direction:column;min-width:0;flex:1"><strong style="font-size:15px">${esc(m.firstName)} ${esc(m.lastName)}</strong><span class="small faint">${esc(m.headline || "")}</span></span>
          ${m.role !== "member" ? `<span class="role-chip role-${esc(m.role)}">${esc(ROLE_LABEL[m.role])}</span>` : ""}
        </a>`).join("")}</div>
        ${list.length >= 300 ? `<p class="small faint">Showing the first 300 members.</p>` : ""}`;
    } catch (e) { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(e))}</p></div>`; }
  }

  function drawAbout() {
    pane.innerHTML = `
      <section class="card stack">
        <h2 style="font-size:18px">About ${esc(c.name)}</h2>
        <p style="white-space:pre-wrap">${esc(c.about || "")}</p>
        <div class="row small faint" style="gap:16px"><span>${esc(TYPE_LABEL[c.type] || "")}</span><span>${esc(c.field || "")}</span><span>${esc(PRIVACY_LABEL[c.privacy] || "")}</span></div>
      </section>
      <section class="card stack"><h2 style="font-size:18px">Rules</h2><p class="muted" style="white-space:pre-wrap">${c.rules ? esc(c.rules) : "This community hasn't posted rules yet. Forge's community standards always apply."}</p></section>
      <section class="card stack"><h2 style="font-size:18px">How moderation works here</h2>
        <p class="small muted">Owner › Admin › Moderator › Helper › Member. Each role can only act on people below it.</p>
        ${rolesTable()}
      </section>`;
  }

  show("posts");
  return () => { if (stop) stop(); };
}
