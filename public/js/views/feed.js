// Home feed: share posts, see what members are building, comment, like and save.
import { sb, many, live } from "../supabase.js";
import { esc, initials, friendlyError, toast, ms as msOf } from "../util.js";
import { composerHTML, bindComposer, createPostList, skeletonPosts } from "../posts.js";
import { myCommunities, badge, fmtCount, membersLabel, runJoinAction, PRIVACY_LABEL, topCommunities, visiblePosts } from "../communities.js";
import { openCreate } from "./communities.js";
import { following as followingOf, peopleWithInterests } from "../network.js";

const DAY = 86400000;

// What's new on Forge. Add a line here whenever an update ships.
const UPDATES = [
  ["New", "Network: connect with people, follow them, and see their posts in your Following feed."],
  ["New", "Communities: join groups in your field, start your own, and pick moderators."],
  ["Next", "Messages, then events."]
];

export function render({ view, state, navigate }) {
  const p = state.profile, uid = state.user.uid;
  const interests = p.interests || [];
  const mine = new Set(interests);

  view.innerHTML = `
    <div class="page"><div class="cols">
      <aside class="col-side">
        <section class="card stack" style="padding:0;overflow:hidden;gap:0">
          <div style="height:60px;background:var(--media)"></div>
          <div class="stack" style="padding:0 18px 18px;gap:6px">
            <a href="#/profile" class="avatar md" style="width:60px;height:60px;margin-top:-30px;border:4px solid var(--surface);font-size:18px">${esc(initials(p.firstName, p.lastName))}</a>
            <a href="#/profile" style="font-weight:600;font-size:17px;text-decoration:none">${esc(p.firstName)} ${esc(p.lastName)}</a>
            <span class="small muted">${esc(p.headline)}</span>
          </div>
          <div style="border-top:1px solid var(--border);padding:12px 18px" class="stack">
            <a href="#/saved" class="small" style="text-decoration:none">Your saved posts →</a>
          </div>
        </section>
        <section class="card stack" id="my-communities">
          <div class="row" style="justify-content:space-between"><h2 style="font-size:15px">Your communities</h2><a href="#/communities" class="small muted">See all</a></div>
          <div class="skeleton" style="height:36px"></div>
        </section>
        <section class="card stack">
          <h2 style="font-size:15px">Your focus areas</h2>
          <div class="row" style="gap:6px">${interests.map(t => `<button class="tag tag-btn" data-filter="${esc(t)}">${esc(t)}</button>`).join("")}</div>
          <a href="#/settings" class="small muted">Edit interests in Settings</a>
        </section>
      </aside>

      <section class="col-main">
        <div class="tabs" role="tablist" aria-label="Feed">
          <button class="tab" role="tab" aria-selected="true" data-tab="foryou">For you</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="latest">Latest</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="following">Following</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="communities">Communities</button>
        </div>
        ${composerHTML(p)}
        <div id="feed-filter" hidden></div>
        <div id="feed-list" class="stack" style="gap:16px">${skeletonPosts(3)}</div>
      </section>

      <aside class="col-right">
        <section class="card stack">
          <div class="kicker">Your briefing</div>
          <h2 style="font-size:16px">Forge updates</h2>
          <ul class="brief-list">${UPDATES.map(([k, t]) => `<li><span class="brief-k">${k}</span><span class="small">${esc(t)}</span></li>`).join("")}</ul>
        </section>
        <section class="card stack">
          <h2 style="font-size:16px">Trending topics</h2>
          <div class="row" style="gap:6px" id="trending"><span class="small muted">Loading…</span></div>
        </section>
        <section class="card stack">
          <div class="row" style="justify-content:space-between"><h2 style="font-size:16px">People in your fields</h2><a href="#/network/suggested" class="small muted">See more</a></div>
          <div class="stack" style="gap:12px" id="people"><div class="skeleton" style="height:40px"></div></div>
        </section>
        <section class="card stack">
          <h2 style="font-size:16px">Career events and STEM news</h2>
          <p class="small muted">Career fairs, networking nights and news picked for your interests are on the way.</p>
        </section>
      </aside>
    </div></div>`;

  if (sessionStorage.getItem("forge.welcome")) {
    sessionStorage.removeItem("forge.welcome");
    toast(`<strong>Welcome to Forge, ${esc(p.firstName)}.</strong> <span class="muted">Start by sharing what you're working on.</span>`, 7000);
  }

  bindComposer(view.querySelector("[data-composer]"), state);

  let tab = "foryou", filter = "", posts = [], cPosts = null, joined = null;
  let cUnsub = null;
  let fPosts = null, fCount = null, fUnsub = null;
  const listEl = view.querySelector("#feed-list");
  const filterEl = view.querySelector("#feed-filter");

  const matchOf = post => (post.tags || []).filter(t => mine.has(t));
  const list = createPostList(listEl, {
    state, showCommunity: true,
    empty: () => emptyHTML(),
    reasonFor: post => {
      if (tab !== "foryou" || post.authorId === uid) return "";
      const m = matchOf(post);
      return m.length ? `Matches your interest: ${m[0]}` : "";
    },
    onTag: t => setFilter(t)
  });

  const emptyHTML = () => tab === "following" && !filter
    ? `<div class="card stack" style="text-align:center;border-style:dashed;align-items:center"><p class="muted">${fCount ? "The people you follow haven't posted recently." : "Follow people or connect with them, and their posts show up here."}</p><a class="btn primary" href="#/network/suggested">Find people</a></div>`
    : tab === "communities" && joined && !joined.length
    ? `<div class="card stack" style="text-align:center;border-style:dashed;align-items:center"><p class="muted">Join communities and their latest posts show up here.</p><a class="btn primary" href="#/communities/discover">Discover communities</a></div>`
    : `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${tab === "communities" && !filter ? "No posts in your communities yet. Open one and start a conversation." : filter
    ? `No recent posts tagged ${esc(filter)} yet. Be the first.`
    : "No posts yet. Be the first to share what you're building."}</p></div>`;

  const ms = post => msOf(post.createdAt) || Date.now();
  const draw = () => {
    if ((tab === "communities" && cPosts === null) || (tab === "following" && fPosts === null)) { listEl.innerHTML = skeletonPosts(2); return; }
    const source = tab === "communities" ? cPosts : tab === "following" ? fPosts : posts;
    let shown = filter ? source.filter(x => (x.tags || []).includes(filter)) : source.slice();
    if (tab === "communities") shown.sort((a, b) => ms(b) - ms(a));
    if (tab === "foryou") {
      // Recent posts first, with a boost for topics that match your interests.
      // (Kept stable on purpose, so posts don't jump around while you're reading or commenting.)
      const score = x => ms(x) + matchOf(x).length * 1.5 * DAY;
      shown.sort((a, b) => score(b) - score(a));
    }
    list.update(shown);
  };

  function setFilter(t) {
    filter = filter === t ? "" : t;
    filterEl.hidden = !filter;
    filterEl.innerHTML = filter ? `<div class="card row" style="justify-content:space-between;padding:12px 16px"><span>Showing posts tagged <strong>#${esc(filter)}</strong></span><button class="btn ghost" id="clear-filter" style="min-height:34px">Clear</button></div>` : "";
    if (filter) filterEl.querySelector("#clear-filter").onclick = () => setFilter(filter);
    view.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
    draw();
    if (filter) filterEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  view.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => setFilter(b.dataset.filter));

  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    if (tab === "communities") startCommunityFeed();
    if (tab === "following") startFollowingFeed();
    // Reason labels depend on the tab, so redraw cards from scratch.
    list.reset();
    draw();
  });

  // Trending: most-used topics in recent posts.
  const drawTrending = () => {
    const counts = new Map();
    posts.forEach(x => (x.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const el = view.querySelector("#trending");
    el.innerHTML = top.length
      ? top.map(([t, n]) => `<button class="tag tag-btn" data-filter="${esc(t)}" aria-pressed="${t === filter}">#${esc(t)} <span class="faint">${n}</span></button>`).join("")
      : `<span class="small muted">Tag your posts with topics and they'll show up here.</span>`;
    el.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => setFilter(b.dataset.filter));
  };

  // Live updates: new posts appear without refreshing.
  const unsub = live(["posts"],
    () => many(sb.from("posts").select("*").is("community_id", null).order("created_at", { ascending: false }).limit(60)),
    list => { posts = list; draw(); drawTrending(); },
    err => { listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });

  loadPeople(view, uid, interests);

  // Your communities, for the left column and the Communities tab.
  const joinedReady = myCommunities(uid).then(r => { joined = r; drawMyCommunities(); return r; })
    .catch(() => { joined = []; drawMyCommunities(); return []; });

  function drawMyCommunities() {
    const el = view.querySelector("#my-communities"); if (!el) return;
    const head = `<div class="row" style="justify-content:space-between"><h2 style="font-size:15px">Your communities</h2><a href="#/communities" class="small muted">See all</a></div>`;
    if (joined.length) {
      el.innerHTML = head + `<div class="stack" style="gap:10px">${joined.slice(0, 6).map(c => `
        <a href="#/c/${esc(c.id)}" class="row" style="gap:10px;text-decoration:none;flex-wrap:nowrap">${badge(c, 32)}
          <span style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</strong><span class="small faint">${membersLabel(c.memberCount)}</span></span></a>`).join("")}</div>`;
      return;
    }
    // New to communities: suggest a few that match your interests.
    el.innerHTML = head + `<p class="small muted">Find people working on the same things as you.</p><div class="stack" style="gap:10px" id="c-suggest"></div>
      <div class="row" style="gap:8px"><a class="btn" href="#/communities/discover" style="min-height:36px">Browse</a><button class="btn ghost" id="c-start" style="min-height:36px">Start one</button></div>`;
    el.querySelector("#c-start").onclick = () => openCreate(state, navigate);
    topCommunities(50).then(all => {
      const box = el.querySelector("#c-suggest"); if (!box) return;
      const score = c => (c.topics || []).filter(t => mine.has(t)).length * 2 + (c.field === p.field ? 1 : 0);
      const picks = all.filter(c => score(c) > 0).sort((a, b) => score(b) - score(a)).slice(0, 3);
      box.innerHTML = picks.map(c => `
        <div class="row" style="gap:10px;flex-wrap:nowrap">${badge(c, 32)}
          <a href="#/c/${esc(c.id)}" style="display:flex;flex-direction:column;min-width:0;flex:1;text-decoration:none"><strong style="font-size:14px">${esc(c.name)}</strong><span class="small faint">${fmtCount(c.memberCount)} · ${esc(PRIVACY_LABEL[c.privacy] || "")}</span></a>
          <button class="btn ghost small" data-sjoin="${esc(c.id)}" style="min-height:32px;padding:0 10px">${c.privacy === "public" ? "Join" : "Ask"}</button>
        </div>`).join("");
      box.querySelectorAll("[data-sjoin]").forEach(btn => {
        const c = picks.find(x => x.id === btn.dataset.sjoin);
        btn.onclick = () => runJoinAction(btn, c, state, null, async () => {
          if (c.privacy === "public") { joined = await myCommunities(uid).catch(() => joined); drawMyCommunities(); cPosts = null; if (tab === "communities") startCommunityFeed(true); }
          else { btn.textContent = "Requested"; btn.disabled = true; }
        });
      });
    }).catch(() => {});
  }

  // Latest posts from your communities, kept live.
  async function startCommunityFeed(force) {
    if (cUnsub && !force) { draw(); return; }
    if (cUnsub) cUnsub();
    cUnsub = () => {};
    draw();
    const mineList = await joinedReady;
    const ids = (joined || mineList).map(c => c.id).slice(0, 100);
    if (!ids.length) { cPosts = []; draw(); return; }
    cUnsub = live(["posts"], () => visiblePosts(ids, 60),
      list => { cPosts = list; if (tab === "communities") draw(); },
      () => { cPosts = []; if (tab === "communities") draw(); });
  }

  // Posts from up to 30 people you follow (connecting with someone follows them too).
  async function startFollowingFeed() {
    if (fUnsub) { draw(); return; }
    fUnsub = () => {};
    draw();
    let ids = [];
    try { ids = (await followingOf(uid)).sort((a, b) => ms(b) - ms(a)).map(f => f.target).slice(0, 200); } catch (e) { ids = []; }
    fCount = ids.length;
    if (!ids.length) { fPosts = []; draw(); return; }
    fUnsub = live(["posts"],
      () => many(sb.from("posts").select("*").in("author_id", ids).is("community_id", null).order("created_at", { ascending: false }).limit(50)),
      list => { fPosts = list; if (tab === "following") draw(); },
      err => { fPosts = []; if (tab === "following") listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  }

  return () => { unsub(); if (cUnsub) cUnsub(); if (fUnsub) fUnsub(); list.destroy(); };
}

// Members who share at least one of your interests.
async function loadPeople(view, uid, interests) {
  const el = view.querySelector("#people");
  if (!interests.length) { el.innerHTML = `<span class="small muted">Add interests in Settings to meet people in your fields.</span>`; return; }
  try {
    const found = await peopleWithInterests(interests, 12);
    const mine = new Set(interests);
    const people = found.filter(u => u.id !== uid)
      .map(u => ({ ...u, shared: (u.interests || []).filter(t => mine.has(t)) }))
      .sort((a, b) => b.shared.length - a.shared.length).slice(0, 4);
    if (!el.isConnected) return;
    el.innerHTML = people.length ? people.map(m => `
      <a href="#/u/${esc(m.id)}" class="row" style="gap:10px;text-decoration:none;flex-wrap:nowrap">
        <span class="avatar sm">${esc(initials(m.firstName, m.lastName))}</span>
        <span style="display:flex;flex-direction:column;min-width:0">
          <strong style="font-size:14px">${esc(m.firstName)} ${esc(m.lastName)}</strong>
          <span class="small faint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.shared.slice(0, 2).join(" · "))}</span>
        </span>
      </a>`).join("") : `<span class="small muted">As more members join, people who share your interests will show up here.</span>`;
  } catch (e) {
    if (el.isConnected) el.innerHTML = `<span class="small muted">Couldn't load suggestions right now.</span>`;
  }
}
