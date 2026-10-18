// Everything about posts, shared by the feed, profiles and Saved:
// the composer, the post card, likes, comments, saving and deleting.
import {
  db, doc, getDoc, setDoc, deleteDoc, addDoc, collection, query, orderBy, limit,
  onSnapshot, runTransaction, serverTimestamp, getDocs
} from "./firebase.js";
import { esc, initials, timeAgo, friendlyError, toast, icon, TOPICS } from "./util.js";

export const KINDS = [["update", "Update"], ["question", "Question"], ["result", "Result"], ["project", "Project"]];
const KIND_LABEL = Object.fromEntries(KINDS);
const MAX_TAGS = 3;

// Posts live in "posts" (the main feed) or in "communities/{id}/posts".
// Each post object carries _col so every action knows where it lives.
export const colOf = post => post._col || "posts";
const postRef = post => doc(db, colOf(post), post.id);

/* ---------- Composer ---------- */

export function composerHTML(p, { placeholder = "Share a project update, question or result" } = {}) {
  const groups = TOPICS.map(g => `<optgroup label="${esc(g.name)}">${g.topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</optgroup>`).join("");
  return `
    <form class="card stack composer" data-composer>
      <div class="row" style="align-items:flex-start;gap:12px;flex-wrap:nowrap">
        <span class="avatar md">${esc(initials(p.firstName, p.lastName))}</span>
        <label class="sr-only" for="cmp-body">Share something</label>
        <textarea id="cmp-body" class="input" data-body maxlength="3000" placeholder="${esc(placeholder)}" style="flex:1 1 0;min-width:0;min-height:70px"></textarea>
      </div>
      <div class="composer-more stack" data-more hidden>
        <div class="row" style="gap:6px" role="group" aria-label="Type of post">
          ${KINDS.map(([k, l], i) => `<button type="button" class="chip sm" data-kind="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}
        </div>
        <div class="stack" style="gap:8px">
          <span class="small muted">Topics <span class="faint">(up to ${MAX_TAGS}, helps the right people find it)</span></span>
          <div class="row" style="gap:6px" data-tags></div>
          <label class="sr-only" for="cmp-more-topic">Add another topic</label>
          <select id="cmp-more-topic" class="input" data-addtopic style="max-width:280px;min-height:38px"><option value="">Add another topic…</option>${groups}</select>
        </div>
      </div>
      <div class="row" style="justify-content:space-between"><span class="small faint" data-count>0 / 3000</span><button class="btn primary" type="submit" data-post-btn>Post</button></div>
    </form>`;
}

// opts.col: where to save; opts.extra: fields added to every post;
// opts.decide(text): optional auto-moderation, returns { status, note }.
export function bindComposer(form, state, opts = {}) {
  const p = state.profile, uid = state.user.uid;
  const body = form.querySelector("[data-body]");
  const more = form.querySelector("[data-more]");
  const tagBox = form.querySelector("[data-tags]");
  const addSel = form.querySelector("[data-addtopic]");
  const btn = form.querySelector("[data-post-btn]");
  let kind = "update";
  const offered = [...new Set((p.interests || []).slice(0, 8))];
  const picked = new Set();

  const drawTags = () => {
    tagBox.innerHTML = offered.map(t => `<button type="button" class="chip sm" data-tag="${esc(t)}" aria-pressed="${picked.has(t)}">${esc(t)}</button>`).join("");
  };
  drawTags();

  body.addEventListener("focus", () => { more.hidden = false; });
  body.addEventListener("input", () => { form.querySelector("[data-count]").textContent = `${body.value.length} / 3000`; });

  form.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => {
    kind = b.dataset.kind;
    form.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  });
  tagBox.onclick = e => {
    const b = e.target.closest("[data-tag]"); if (!b) return;
    const t = b.dataset.tag;
    if (picked.has(t)) picked.delete(t);
    else if (picked.size >= MAX_TAGS) { toast(`Pick up to ${MAX_TAGS} topics.`); return; }
    else picked.add(t);
    drawTags();
  };
  addSel.onchange = () => {
    const t = addSel.value; addSel.value = "";
    if (!t) return;
    if (!offered.includes(t)) offered.push(t);
    if (!picked.has(t)) {
      if (picked.size >= MAX_TAGS) { toast(`Pick up to ${MAX_TAGS} topics.`); drawTags(); return; }
      picked.add(t);
    }
    drawTags();
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const text = body.value.trim();
    if (!text) { body.focus(); return; }
    btn.disabled = true;
    try {
      const verdict = opts.decide ? opts.decide(text) : null;
      await addDoc(collection(db, opts.col || "posts"), {
        authorId: uid, authorFirst: p.firstName, authorLast: p.lastName, authorHeadline: p.headline || "",
        body: text, kind, tags: [...picked], likeCount: 0, commentCount: 0, createdAt: serverTimestamp(),
        ...(opts.extra || {}), ...(verdict ? { status: verdict.status } : {})
      });
      body.value = ""; body.dispatchEvent(new Event("input"));
      picked.clear(); drawTags(); more.hidden = true;
      toast(verdict && verdict.note ? esc(verdict.note) : "Posted.", verdict && verdict.note ? 8000 : 5000);
    } catch (err) { toast(esc(friendlyError(err))); }
    btn.disabled = false;
  };
}

/* ---------- Post card ---------- */

function actionsHTML(post, { liked, saved, open }) {
  return `
    <button data-act="like" aria-pressed="${liked}">${icon("heart", 18)}<span>${liked ? "Liked" : "Like"}</span><span class="count">${Number(post.likeCount || 0)}</span></button>
    <button data-act="comments" aria-expanded="${open}">${icon("comment", 18)}<span>Comment</span><span class="count">${Number(post.commentCount || 0)}</span></button>
    <button data-act="save" aria-pressed="${saved}" style="margin-left:auto">${icon("saved", 18)}<span>${saved ? "Saved" : "Save"}</span></button>`;
}

export function postCard(post, { liked = false, saved = false, open = false, mine = false, canRemove = false, reason = "", tagsClickable = false, showCommunity = false } = {}) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const kind = KIND_LABEL[post.kind];
  return `
    <article class="card post" data-post="${esc(post.id)}">
      ${reason ? `<div class="post-reason small faint">${esc(reason)}</div>` : ""}
      ${showCommunity && post.communityId ? `<a class="post-community small" href="#/c/${esc(post.communityId)}">in ${esc(post.communityName || "a community")}</a>` : ""}
      <div class="row" style="gap:12px">
        <a class="avatar md" href="#/u/${esc(post.authorId)}">${esc(initials(post.authorFirst, post.authorLast))}</a>
        <div style="display:flex;flex-direction:column;min-width:0;flex:1 1 auto">
          <a href="#/u/${esc(post.authorId)}" style="font-weight:600;text-decoration:none">${esc(post.authorFirst)} ${esc(post.authorLast)}</a>
          <span class="small faint">${esc(post.authorHeadline || "")}${post.authorHeadline ? " · " : ""}${esc(timeAgo(post.createdAt))}</span>
        </div>
        ${kind && post.kind !== "update" ? `<span class="kind kind-${esc(post.kind)}">${esc(kind)}</span>` : ""}
        ${mine || canRemove ? `<button class="btn ghost small" data-act="delete" style="min-height:34px;padding:0 8px">${mine ? "Delete" : "Remove"}</button>` : ""}
      </div>
      <p class="post-body">${esc(post.body)}</p>
      ${tags.length ? `<div class="row" style="gap:6px">${tags.map(t => tagsClickable
        ? `<button class="tag tag-btn" data-act="tag" data-tag="${esc(t)}">#${esc(t)}</button>`
        : `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="post-actions">${actionsHTML(post, { liked, saved, open })}</div>
      <div class="thread" hidden></div>
    </article>`;
}

/* ---------- Data actions ---------- */

// Like or unlike: creates/removes your like and moves the count by one, together.
// Returns true if the post is now liked.
export async function toggleLike(post, uid) {
  const ref = postRef(post);
  const likeRef = doc(db, colOf(post), post.id, "likes", uid);
  return runTransaction(db, async tx => {
    const [p, l] = await Promise.all([tx.get(ref), tx.get(likeRef)]);
    if (!p.exists()) throw Object.assign(new Error("This post was removed."), { code: "not-found" });
    const count = Number(p.data().likeCount || 0);
    if (l.exists()) { tx.delete(likeRef); tx.update(ref, { likeCount: count - 1 }); return false; }
    tx.set(likeRef, { at: Date.now() }); tx.update(ref, { likeCount: count + 1 }); return true;
  });
}

export async function likedSet(posts, uid) {
  const out = new Set();
  await Promise.all(posts.map(async post => {
    try { const s = await getDoc(doc(db, colOf(post), post.id, "likes", uid)); if (s.exists()) out.add(post.id); } catch (e) {}
  }));
  return out;
}

export async function addComment(post, state, text) {
  const p = state.profile, uid = state.user.uid;
  const ref = postRef(post);
  const cRef = doc(collection(db, colOf(post), post.id, "comments"));
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw Object.assign(new Error("This post was removed."), { code: "not-found" });
    tx.set(cRef, { authorId: uid, authorFirst: p.firstName, authorLast: p.lastName, body: text, createdAt: serverTimestamp() });
    tx.update(ref, { commentCount: Number(snap.data().commentCount || 0) + 1 });
  });
}

export async function deleteComment(post, commentId) {
  const ref = postRef(post);
  const cRef = doc(db, colOf(post), post.id, "comments", commentId);
  await runTransaction(db, async tx => {
    const [snap, c] = await Promise.all([tx.get(ref), tx.get(cRef)]);
    if (!c.exists()) return;
    tx.delete(cRef);
    const n = snap.exists() ? Number(snap.data().commentCount || 0) : 0;
    if (n > 0) tx.update(ref, { commentCount: n - 1 });
  });
}

export async function toggleSave(post, uid, isSaved) {
  const ref = doc(db, "users", uid, "saved", post.id);
  if (isSaved) { await deleteDoc(ref); return false; }
  await setDoc(ref, { postId: post.id, col: colOf(post), authorId: post.authorId || "", savedAt: serverTimestamp() });
  return true;
}

// Removes a post's comments first so nothing is left behind, then the post.
export async function deletePost(post) {
  try {
    const cs = await getDocs(collection(db, colOf(post), post.id, "comments"));
    await Promise.all(cs.docs.map(d => deleteDoc(d.ref)));
  } catch (e) { /* the post itself is what matters */ }
  await deleteDoc(postRef(post));
}

/* ---------- Live post list ---------- */

// Draws posts into a container and keeps them up to date without
// closing open comment threads or losing what someone is typing.
// modFor(post): true if you can remove this post and its comments (community moderators).
export function createPostList(container, { state, empty, reasonFor, onTag, modFor, showCommunity = false, canComment }) {
  const uid = state.user.uid;
  const liked = new Set(), saved = new Set(), known = new Set();
  const nodes = new Map();      // post id -> element
  const threads = new Map();    // post id -> unsubscribe
  let posts = [], seq = 0, destroyed = false, savedReady = false;

  const optsFor = post => ({
    liked: liked.has(post.id), saved: saved.has(post.id), open: threads.has(post.id),
    mine: post.authorId === uid, canRemove: !!(modFor && modFor(post)), reason: reasonFor ? reasonFor(post) : "",
    tagsClickable: !!onTag, showCommunity
  });
  const sig = post => [post.likeCount || 0, post.commentCount || 0, liked.has(post.id), saved.has(post.id), threads.has(post.id)].join("|");

  const refreshActions = () => {
    posts.forEach(post => {
      const el = nodes.get(post.id); if (!el) return;
      const s = sig(post);
      if (el.dataset.sig === s) return;
      el.dataset.sig = s;
      el.querySelector(".post-actions").innerHTML = actionsHTML(post, optsFor(post));
    });
  };

  const paint = () => {
    if (destroyed) return;
    const ids = new Set(posts.map(x => x.id));
    for (const [id, el] of nodes) if (!ids.has(id)) { closeThread(id); el.remove(); nodes.delete(id); }
    [...container.children].forEach(ch => { if (!ch.dataset.post || !nodes.has(ch.dataset.post)) ch.remove(); });
    if (!posts.length) { container.innerHTML = typeof empty === "function" ? empty() : empty; return; }
    posts.forEach((post, i) => {
      let el = nodes.get(post.id);
      if (!el) {
        const t = document.createElement("template");
        t.innerHTML = postCard(post, optsFor(post)).trim();
        el = t.content.firstElementChild;
        el.classList.add("rise");
        el.dataset.sig = sig(post);
        nodes.set(post.id, el);
      }
      if (container.children[i] !== el) container.insertBefore(el, container.children[i] || null);
    });
    refreshActions();
  };

  const unsubSaved = onSnapshot(query(collection(db, "users", uid, "saved"), limit(500)), snap => {
    saved.clear(); snap.forEach(d => saved.add(d.id)); savedReady = true; refreshActions();
  }, () => {});

  function closeThread(id) {
    const un = threads.get(id); if (un) un();
    threads.delete(id);
    const el = nodes.get(id);
    if (el) { const box = el.querySelector(".thread"); box.hidden = true; box.innerHTML = ""; }
  }

  function openThread(id) {
    const el = nodes.get(id), post = posts.find(x => x.id === id);
    if (!el || !post) return;
    const box = el.querySelector(".thread");
    const p = state.profile;
    box.hidden = false;
    box.innerHTML = `
      <div class="thread-list stack" style="gap:12px"><div class="skeleton" style="height:14px;width:60%"></div></div>
      <form class="thread-form row" style="gap:10px;flex-wrap:nowrap">
        <span class="avatar sm">${esc(initials(p.firstName, p.lastName))}</span>
        <label class="sr-only" for="c-${esc(id)}">Write a comment</label>
        <input id="c-${esc(id)}" class="input" maxlength="1000" placeholder="Add a comment" autocomplete="off" style="min-height:40px">
        <button class="btn primary" style="min-height:40px">Reply</button>
      </form>`;
    const listEl = box.querySelector(".thread-list");
    if (canComment && !canComment(post)) box.querySelector("form").outerHTML = `<p class="small muted">Join this community to comment.</p>`;
    const form = box.querySelector("form") || document.createElement("form");
    const input = form.querySelector("input") || document.createElement("input");
    form.onsubmit = async e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      const b = form.querySelector("button"); b.disabled = true;
      try { await addComment(post, state, text); input.value = ""; }
      catch (err) { toast(esc(friendlyError(err))); }
      b.disabled = false; input.focus();
    };
    const un = onSnapshot(query(collection(db, colOf(post), id, "comments"), orderBy("createdAt", "asc"), limit(100)), snap => {
      const cs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      listEl.innerHTML = cs.length ? cs.map(c => `
        <div class="comment row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap">
          <a class="avatar sm" href="#/u/${esc(c.authorId)}">${esc(initials(c.authorFirst, c.authorLast))}</a>
          <div class="comment-bubble">
            <div class="row" style="gap:8px"><a href="#/u/${esc(c.authorId)}" style="font-weight:600;font-size:14px;text-decoration:none">${esc(c.authorFirst)} ${esc(c.authorLast)}</a><span class="small faint">${esc(timeAgo(c.createdAt))}</span>
              ${c.authorId === uid || post.authorId === uid || (modFor && modFor(post)) ? `<button class="link-btn small" data-act="cdel" data-cid="${esc(c.id)}" style="margin-left:auto">Delete</button>` : ""}</div>
            <p style="white-space:pre-wrap;word-wrap:break-word;font-size:14px">${esc(c.body)}</p>
          </div>
        </div>`).join("") : `<p class="small muted">No comments yet. Start the conversation.</p>`;
    }, err => { listEl.innerHTML = `<p class="error">${esc(friendlyError(err))}</p>`; });
    threads.set(id, un);
    input.focus();
  }

  const onClick = async e => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !container.contains(btn)) return;
    const card = btn.closest("[data-post]"); if (!card) return;
    const id = card.dataset.post;
    const post = posts.find(x => x.id === id); if (!post) return;
    const act = btn.dataset.act;

    if (act === "like") {
      const was = liked.has(id);
      was ? liked.delete(id) : liked.add(id);
      post.likeCount = Number(post.likeCount || 0) + (was ? -1 : 1);
      refreshActions();
      try { await toggleLike(post, uid); }
      catch (err) {
        was ? liked.add(id) : liked.delete(id);
        post.likeCount = Number(post.likeCount || 0) + (was ? 1 : -1);
        refreshActions(); toast(esc(friendlyError(err)));
      }
    } else if (act === "comments") {
      threads.has(id) ? closeThread(id) : openThread(id);
      refreshActions();
    } else if (act === "save") {
      if (!savedReady) return;
      btn.disabled = true;
      try {
        const now = await toggleSave(post, uid, saved.has(id));
        if (now) toast(`Saved. Find it any time under <strong>Saved</strong> in the menu.`);
      } catch (err) { toast(esc(friendlyError(err))); }
      btn.disabled = false;
    } else if (act === "delete") {
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Click again to delete"; return; }
      btn.disabled = true;
      try { await deletePost(post); toast(post.authorId === uid ? "Post deleted." : "Post removed."); } catch (err) { toast(esc(friendlyError(err))); btn.disabled = false; }
    } else if (act === "tag") {
      onTag && onTag(btn.dataset.tag);
    } else if (act === "cdel") {
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Confirm delete"; return; }
      try { await deleteComment(post, btn.dataset.cid); } catch (err) { toast(esc(friendlyError(err))); }
    }
  };
  container.addEventListener("click", onClick);

  return {
    async update(list) {
      const mySeq = ++seq;
      posts = list;
      const unknown = list.filter(x => !known.has(x.id));
      if (unknown.length) {
        const s = await likedSet(unknown, uid);
        if (destroyed || mySeq !== seq) return;
        unknown.forEach(x => { known.add(x.id); if (s.has(x.id)) liked.add(x.id); });
      }
      paint();
    },
    // Redraw every card from scratch (for example when switching feed tabs).
    reset() {
      [...threads.keys()].forEach(closeThread);
      nodes.forEach(el => el.remove()); nodes.clear();
      container.innerHTML = "";
    },
    destroy() {
      destroyed = true;
      unsubSaved();
      [...threads.keys()].forEach(closeThread);
      container.removeEventListener("click", onClick);
    }
  };
}

export function skeletonPosts(n = 2) {
  return Array.from({ length: n }, () => `
    <div class="card stack" aria-hidden="true">
      <div class="row"><div class="skeleton" style="width:44px;height:44px;border-radius:50%"></div><div class="stack" style="gap:8px;flex:1"><div class="skeleton" style="width:40%;height:12px"></div><div class="skeleton" style="width:25%;height:10px"></div></div></div>
      <div class="skeleton" style="width:92%;height:12px"></div><div class="skeleton" style="width:70%;height:12px"></div>
    </div>`).join("");
}
