// One post with its comments open: #/post/<id>. Notifications link here.
import { sb, many, live } from "../supabase.js";
import { esc, friendlyError } from "../util.js";
import { createPostList, skeletonPosts } from "../posts.js";

export function render({ view, state, params }) {
  const id = params[0] || "";
  view.innerHTML = `
    <div class="page" style="max-width:760px">
      <p style="margin-bottom:16px"><button class="link-btn" id="post-back">← Back</button></p>
      <div id="post-one" class="stack" style="gap:16px">${skeletonPosts(1)}</div>
    </div>`;
  const box = view.querySelector("#post-one");
  view.querySelector("#post-back").onclick = () => history.length > 1 ? history.back() : (location.hash = "#/feed");
  const list = createPostList(box, {
    state, showCommunity: true,
    empty: `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">This post was deleted, or it's in a community you can't see.</p><p style="margin-top:12px"><a class="btn" href="#/feed">Go to your feed</a></p></div>`
  });
  let opened = false;
  const unsub = live(["posts"], () => many(sb.from("posts").select("*").eq("id", id).limit(1)), async posts => {
    await list.update(posts);
    if (!opened && posts.length) { opened = true; box.querySelector('[data-act="comments"]')?.click(); }
  }, err => { box.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  return () => { unsub(); list.destroy(); };
}
