// Saved: posts you bookmarked, newest save first.
// When an author deletes a post, it disappears from everyone's Saved list too.
import { sb, run, row, live } from "../supabase.js";
import { esc, friendlyError } from "../util.js";
import { createPostList, skeletonPosts } from "../posts.js";

export function render({ view, state }) {
  const uid = state.user.uid;
  view.innerHTML = `
    <div class="page" style="max-width:760px">
      <div class="stack" style="gap:6px;margin-bottom:20px">
        <div class="kicker">Saved</div>
        <h1 style="font-size:28px">Your saved posts</h1>
        <p class="muted">Tap <strong>Save</strong> on any post to keep it here. Folders and saved events come later.</p>
      </div>
      <div id="saved-list" class="stack" style="gap:16px">${skeletonPosts(2)}</div>
    </div>`;

  const listEl = view.querySelector("#saved-list");
  const list = createPostList(listEl, {
    state, showCommunity: true,
    empty: `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">Nothing saved yet. Use <strong>Save</strong> on a post in your feed.</p><p style="margin-top:12px"><a class="btn" href="#/feed">Go to your feed</a></p></div>`
  });

  // Posts you can no longer see (for example, you left a private community) are left out.
  const unsub = live(["saved", "posts"],
    () => run(sb.from("saved").select("saved_at, posts(*)").eq("user_id", uid).order("saved_at", { ascending: false }).limit(100)),
    rs => list.update(rs.filter(r => r.posts).map(r => row(r.posts))),
    err => { listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });

  return () => { unsub(); list.destroy(); };
}
