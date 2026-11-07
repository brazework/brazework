// Profile page: yours (editable) or another member's.
import { sb, run, many, live } from "../supabase.js";
import { esc, initials, friendlyError, toast, icon } from "../util.js";
import { composerHTML, bindComposer, createPostList, skeletonPosts } from "../posts.js";
import { relationship, sendRequest, accept, removeConnection, follow, unfollow, counts, askNote, getProfile } from "../network.js";
import { start as startConversation } from "../messages.js";
import { recordView } from "../activity.js";

export async function render({ view, state, params, name, refreshProfile, navigate }) {
  const myUid = state.user.uid;
  const uid = name === "u" && params[0] ? params[0] : myUid;
  const isMe = uid === myUid;

  view.innerHTML = `<div class="page"><div class="skeleton" style="height:180px;border-radius:14px"></div><div style="height:16px"></div>${skeletonPosts(2)}</div>`;

  let p;
  if (isMe) p = state.profile;
  else {
    try { p = await getProfile(uid); }
    catch (e) { p = null; }
  }
  if (!p) { view.innerHTML = `<div class="page"><div class="card"><h1 style="font-size:22px">Profile not found</h1><p class="muted">This member may have left Forge.</p></div></div>`; return; }

  if (!isMe) recordView(uid);
  const badge = p.accountType === "student" ? "Verified student" : "Verified professional";
  view.innerHTML = `
    <div class="page stack" style="gap:24px">
      <section class="card" style="padding:0;overflow:hidden">
        <div style="height:170px;background-color:var(--media);background-image:linear-gradient(var(--media-grid) 1px,transparent 1px),linear-gradient(90deg,var(--media-grid) 1px,transparent 1px);background-size:32px 32px"></div>
        <div class="row" style="padding:0 28px 24px;align-items:flex-end;gap:24px">
          <span class="avatar lg" style="margin-top:-60px;border:5px solid var(--surface)">${esc(initials(p.firstName, p.lastName))}</span>
          <div class="stack" style="gap:4px;flex:1 1 320px;padding-top:12px">
            <div class="row" style="gap:10px"><h1 style="font-size:28px">${esc(p.firstName)} ${esc(p.lastName)}</h1><span class="tag" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em">${badge}</span></div>
            <span class="muted" id="pf-headline">${esc(p.headline)}</span>
            <span class="small faint">${esc(p.field || "")}</span>
            <div class="row small" id="pf-counts" style="gap:16px;margin-top:6px"><span class="skeleton" style="width:220px;height:14px"></span></div>
          </div>
          ${isMe ? `<div class="row" style="gap:8px"><a class="btn" href="#/analytics">${icon("chart", 16)}Analytics</a><button class="btn" id="pf-edit">Edit profile</button></div>` : `<div class="row" style="gap:8px" id="pf-actions"><span class="skeleton" style="width:180px;height:44px"></span></div>`}
        </div>
      </section>
      <div class="cols">
        <aside class="col-side" style="max-width:360px">
          <section class="card stack" id="pf-about">
            <h2 style="font-size:17px">About</h2>
            <p class="muted" style="white-space:pre-wrap">${p.bio ? esc(p.bio) : (isMe ? "Add a short bio so people know what you work on." : "No bio yet.")}</p>
          </section>
          <section class="card stack">
            <h2 style="font-size:17px">Interests</h2>
            <div class="row" style="gap:6px">${(p.interests || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          </section>
        </aside>
        <section class="col-main">
          <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true">Posts</button><button class="tab" role="tab" aria-selected="false" disabled title="Coming soon">Projects · soon</button></div>
          ${isMe ? composerHTML(p, { placeholder: "Share an update on your profile" }) : ""}
          <div id="pf-posts" class="stack" style="gap:16px">${skeletonPosts(2)}</div>
        </section>
      </div>
    </div>`;

  if (isMe) view.querySelector("#pf-edit").onclick = () => openEditor(view, state, refreshProfile);

  // Connections and followers.
  const drawCounts = async () => {
    const n = await counts(uid);
    const el = view.querySelector("#pf-counts"); if (!el) return;
    const item = (v, l, tab) => v === null ? "" : (isMe ? `<a href="#/network/${tab}" class="pf-count"><strong>${v}</strong> ${l}</a>` : `<span class="pf-count"><strong>${v}</strong> ${l}</span>`);
    el.innerHTML = [item(n.connections, n.connections === 1 ? "connection" : "connections", "connections"), item(n.followers, n.followers === 1 ? "follower" : "followers", "followers"), item(n.following, "following", "following")].join("");
  };
  drawCounts();

  if (!isMe) {
    const other = { id: uid, ...p };
    const box = view.querySelector("#pf-actions");
    const drawActions = async () => {
      let rel;
      try { rel = await relationship(myUid, uid); } catch (e) { box.innerHTML = ""; return; }
      const main = {
        none: `<button class="btn primary" data-a="connect">Connect</button>`,
        sent: `<button class="btn" data-a="withdraw">Pending · withdraw</button>`,
        received: `<button class="btn primary" data-a="accept">Accept request</button><button class="btn ghost" data-a="ignore">Ignore</button>`,
        connected: `<button class="btn" data-a="disconnect">Connected ✓</button>`
      }[rel.status];
      box.innerHTML = main + (rel.following
        ? `<button class="btn ghost" data-a="unfollow">Following</button>`
        : `<button class="btn ghost" data-a="follow">+ Follow</button>`)
        + `<button class="btn ghost" data-a="message" title="${rel.status === "connected" ? "" : "Not connected yet: this arrives as a message request"}">Message</button>`;
      if (rel.status === "received" && rel.conn.note) box.insertAdjacentHTML("beforeend", `<p class="small person-note" style="flex-basis:100%">“${esc(rel.conn.note)}”</p>`);
      box.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
        const a = b.dataset.a;
        if (a === "disconnect" && b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = `Remove connection?`; return; }
        let note = "";
        if (a === "connect") { note = await askNote(other); if (note === null) return; }
        b.disabled = true;
        try {
          if (a === "message") { navigate(`messages/${await startConversation(uid)}`); return; }
          if (a === "connect") { await sendRequest(state, other, note); toast(`Request sent to <strong>${esc(p.firstName)}</strong>.`); }
          if (a === "withdraw") { await removeConnection(rel.conn.id); toast("Invitation withdrawn."); }
          if (a === "accept") { await accept(state, rel.conn); toast(`You're now connected with <strong>${esc(p.firstName)}</strong>.`); }
          if (a === "ignore" || a === "disconnect") await removeConnection(rel.conn.id);
          if (a === "follow") await follow(state, other);
          if (a === "unfollow") await unfollow(myUid, uid);
          await drawActions(); drawCounts();
        } catch (e) { toast(esc(friendlyError(e))); b.disabled = false; }
      });
    };
    drawActions();
  }

  if (isMe) bindComposer(view.querySelector("[data-composer]"), state);

  const listEl = view.querySelector("#pf-posts");
  const list = createPostList(listEl, {
    state,
    empty: `<div class="card" style="border-style:dashed;text-align:center"><p class="muted">${isMe ? "Nothing posted yet. Share your first update above." : "No posts yet."}</p></div>`
  });
  const unsub = live(["posts"],
    () => many(sb.from("posts").select("*").eq("author_id", uid).is("community_id", null).order("created_at", { ascending: false }).limit(50)),
    posts => list.update(posts),
    err => { listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  return () => { unsub(); list.destroy(); };
}

function openEditor(view, state, refreshProfile) {
  const p = state.profile;
  const about = view.querySelector("#pf-about");
  about.innerHTML = `
    <h2 style="font-size:17px">Edit profile</h2>
    <div class="field"><label for="ed-head">Headline</label><input id="ed-head" class="input" maxlength="120" value="${esc(p.headline)}"></div>
    <div class="field"><label for="ed-bio">Bio</label><textarea id="ed-bio" class="input" maxlength="600">${esc(p.bio || "")}</textarea></div>
    <div class="row"><button class="btn primary" id="ed-save">Save</button><button class="btn" id="ed-cancel">Cancel</button></div>`;
  about.querySelector("#ed-cancel").onclick = () => location.reload();
  about.querySelector("#ed-save").onclick = async () => {
    const headline = about.querySelector("#ed-head").value.trim(), bio = about.querySelector("#ed-bio").value.trim();
    try {
      await run(sb.from("profiles").update({ headline, bio }).eq("id", state.user.uid));
      await refreshProfile();
      toast("Profile saved.");
      about.innerHTML = `<h2 style="font-size:17px">About</h2><p class="muted" style="white-space:pre-wrap">${bio ? esc(bio) : "Add a short bio so people know what you work on."}</p>`;
      view.querySelector("#pf-headline").textContent = headline;
    } catch (e) { toast(esc(friendlyError(e))); }
  };
}
