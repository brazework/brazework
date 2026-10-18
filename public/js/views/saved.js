// Saved: posts you bookmarked, newest save first.
import { db, collection, query, orderBy, limit, onSnapshot, getDoc, doc, deleteDoc } from "../firebase.js";
import { esc, friendlyError, toast } from "../util.js";
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
      <div id="saved-gone"></div>
      <div id="saved-list" class="stack" style="gap:16px">${skeletonPosts(2)}</div>
    </div>`;

  const listEl = view.querySelector("#saved-list");
  const goneEl = view.querySelector("#saved-gone");
  const list = createPostList(listEl, {
    state, showCommunity: true,
    empty: `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">Nothing saved yet. Use <strong>Save</strong> on a post in your feed.</p><p style="margin-top:12px"><a class="btn" href="#/feed">Go to your feed</a></p></div>`
  });

  const cache = new Map();
  let seq = 0;
  const unsub = onSnapshot(query(collection(db, "users", uid, "saved"), orderBy("savedAt", "desc"), limit(100)), async snap => {
    const mySeq = ++seq;
    const items = snap.docs.map(d => ({ id: d.id, col: d.data().col || "posts" }));
    const gone = [];
    const posts = (await Promise.all(items.map(async ({ id, col }) => {
      if (cache.has(id)) return cache.get(id);
      try {
        const s = await getDoc(doc(db, col, id));
        if (!s.exists()) { gone.push(id); return null; }
        const post = { id, _col: col, ...s.data() }; cache.set(id, post); return post;
      } catch (e) { return null; }
    }))).filter(Boolean);
    if (mySeq !== seq) return;
    goneEl.innerHTML = gone.length ? `<div class="card row" style="justify-content:space-between;margin-bottom:16px;padding:12px 16px">
        <span class="small muted">${gone.length === 1 ? "1 saved post was" : `${gone.length} saved posts were`} removed by the author.</span>
        <button class="btn ghost" id="clear-gone" style="min-height:34px">Clear</button></div>` : "";
    const clear = goneEl.querySelector("#clear-gone");
    if (clear) clear.onclick = async () => {
      try { await Promise.all(gone.map(id => deleteDoc(doc(db, "users", uid, "saved", id)))); }
      catch (e) { toast(esc(friendlyError(e))); }
    };
    list.update(posts);
  }, err => { listEl.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });

  return () => { unsub(); list.destroy(); };
}
