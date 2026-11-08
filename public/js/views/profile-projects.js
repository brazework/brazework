// The Projects tab on a profile: the owner adds, edits, shares and deletes projects;
// visitors see each card, and the full write-up only when the project is public.
import { live } from "../supabase.js";
import { esc, friendlyError, toast, icon } from "../util.js";
import {
  projectsOf, detailsFor, saveProject, setPrivate, deleteProject, postAboutProject,
  projectMeta, privateBadge, topicOptions, safeLink, MAX_PROJECT_TAGS
} from "../projects.js";

export function renderProjects(box, { state, uid, isMe, ownerFirst, focusId, onCount }) {
  let list = null, details = new Map(), error = "", editing = null, focused = false;

  const formHTML = (pr, d) => {
    const tags = new Set(pr ? pr.tags : []);
    const offered = [...new Set([...(state.profile.interests || []).slice(0, 8), ...tags])];
    const status = pr ? pr.status : "in_progress";
    return `<form class="card stack pj-form" data-form="${pr ? esc(pr.id) : "new"}">
      <h3 style="font-size:17px">${pr ? "Edit project" : "New project"}</h3>
      <div class="field"><label for="pj-title">Title</label><input id="pj-title" class="input" name="title" maxlength="120" required value="${esc(pr ? pr.title : "")}" placeholder="Tendon-driven robotic hand"></div>
      <div class="field"><label for="pj-summary">Summary <span class="faint small">(everyone sees this, even when the project is private)</span></label>
        <textarea id="pj-summary" class="input" name="summary" maxlength="600" required style="min-height:80px" placeholder="What it is, what it does and where it's at.">${esc(pr ? pr.summary : "")}</textarea></div>
      <div class="row" style="gap:16px;align-items:flex-end">
        <div class="stack" style="gap:6px"><span class="small" style="font-weight:500">Status</span>
          <div class="row" style="gap:6px" role="group" aria-label="Status">
            <button type="button" class="chip sm" data-status="in_progress" aria-pressed="${status === "in_progress"}">In progress</button>
            <button type="button" class="chip sm" data-status="completed" aria-pressed="${status === "completed"}">Completed</button>
          </div></div>
        <div class="field" data-year ${status === "completed" ? "" : "hidden"} style="max-width:120px"><label for="pj-year">Year</label><input id="pj-year" class="input" name="year" type="number" min="1950" max="2100" value="${esc(pr && pr.year ? pr.year : new Date().getFullYear())}"></div>
      </div>
      <div class="stack" style="gap:8px">
        <span class="small" style="font-weight:500">Topics <span class="faint">(up to ${MAX_PROJECT_TAGS}, so it reaches people interested in them)</span></span>
        <div class="row" style="gap:6px" data-tags>${offered.map(t => `<button type="button" class="chip sm" data-tag="${esc(t)}" aria-pressed="${tags.has(t)}">${esc(t)}</button>`).join("")}</div>
        <label class="sr-only" for="pj-more">Add another topic</label>
        <select id="pj-more" class="input" data-addtopic style="max-width:280px;min-height:38px"><option value="">Add another topic…</option>${topicOptions()}</select>
      </div>
      <div class="field"><label for="pj-details">Full write-up <span class="faint small">(optional; hidden from others while private)</span></label>
        <textarea id="pj-details" class="input" name="details" maxlength="5000" style="min-height:100px" placeholder="Goals, how you built it, results, what's next.">${esc(d ? d.details : "")}</textarea></div>
      <div class="field"><label for="pj-link">Link <span class="faint small">(optional, e.g. GitHub; hidden while private)</span></label><input id="pj-link" class="input" name="link" type="url" maxlength="300" value="${esc(d ? d.link : "")}" placeholder="https://"></div>
      <label class="row pj-check"><input type="checkbox" name="private" ${pr && pr.private ? "checked" : ""}> <span>Private: others see only the title, summary and topics</span></label>
      ${pr ? "" : `<label class="row pj-check"><input type="checkbox" name="share" checked> <span>Share it to the feed so people interested in these topics see it</span></label>`}
      <div class="row"><button class="btn primary" type="submit">${pr ? "Save" : "Add project"}</button><button class="btn" type="button" data-cancel>Cancel</button></div>
    </form>`;
  };

  const cardHTML = pr => {
    const d = details.get(pr.id), link = safeLink(d && d.link);
    if (editing === pr.id) return formHTML(pr, d);
    return `<article class="card stack pj-card" data-project="${esc(pr.id)}" id="project-${esc(pr.id)}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div class="stack" style="gap:4px;min-width:0">
          <div class="row" style="gap:8px"><h3 style="font-size:18px">${esc(pr.title)}</h3>${pr.private ? privateBadge : ""}</div>
          <span class="small faint">${esc(projectMeta(pr))}</span>
        </div>
        ${isMe ? `<button class="btn ghost small" data-act="privacy" style="min-height:34px">${pr.private ? "Make public" : "Make private"}</button>` : ""}
      </div>
      <p style="white-space:pre-wrap">${esc(pr.summary)}</p>
      ${(pr.tags || []).length ? `<div class="row" style="gap:6px">${pr.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      ${d && (d.details || link) ? `<details class="pj-more"><summary>Read the full write-up</summary>
        ${d.details ? `<p style="white-space:pre-wrap;margin-top:10px">${esc(d.details)}</p>` : ""}
        ${link ? `<p style="margin-top:10px"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">${esc(link.replace(/^https?:\/\//, ""))} ↗</a></p>` : ""}
      </details>` : ""}
      ${!isMe && pr.private ? `<div class="row" style="gap:10px"><button class="btn" disabled aria-disabled="true">${icon("lock", 14)}Access requests coming soon</button><span class="small faint">Access will go through a Forge NDA, an identity check and ${esc(ownerFirst)}'s approval.</span></div>` : ""}
      ${isMe ? `<div class="pj-update stack" data-update hidden>
          <label class="sr-only" for="pu-${esc(pr.id)}">Your update</label>
          <textarea id="pu-${esc(pr.id)}" class="input" maxlength="3000" style="min-height:70px" placeholder="What changed? Results, a new milestone, a question for people in your field."></textarea>
          <div class="row"><button class="btn primary" data-act="post-update">Post to feed</button><button class="btn" data-act="cancel-update">Cancel</button></div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn" data-act="update">Post an update</button>
          <button class="btn ghost" data-act="edit">Edit</button>
          <button class="btn ghost" data-act="delete" style="margin-left:auto">Delete</button>
        </div>` : ""}
    </article>`;
  };

  const draw = () => {
    if (error) { box.innerHTML = `<div class="card"><p class="error">${esc(error)}</p></div>`; return; }
    if (!list) { box.innerHTML = `<div class="skeleton" style="height:160px;border-radius:14px"></div>`; return; }
    const head = isMe ? `<div class="card row" style="justify-content:space-between;gap:12px">
        <p class="small muted" style="flex:1 1 260px">Show what you've built. Private projects show only a summary; requests to see the rest are coming soon.</p>
        <button class="btn primary" data-act="new" data-tour="projects-new" ${editing === "new" ? "disabled" : ""}>New project</button>
      </div>${editing === "new" ? formHTML(null, null) : ""}` : "";
    const empty = !list.length && editing !== "new"
      ? `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${isMe ? "No projects yet. Add one and share it with people in your field." : `${esc(ownerFirst)} hasn't added any projects yet.`}</p></div>` : "";
    box.innerHTML = head + empty + list.map(cardHTML).join("");
    bindForms();
    if (focusId && !focused && list.some(p => p.id === focusId)) {
      focused = true;
      const el = box.querySelector(`#project-${CSS.escape(focusId)}`);
      if (el) { el.classList.add("pj-focus"); el.scrollIntoView({ block: "center" }); }
    }
  };

  function bindForms() {
    box.querySelectorAll("[data-form]").forEach(form => {
      const id = form.dataset.form === "new" ? null : form.dataset.form;
      let status = form.querySelector('[data-status][aria-pressed="true"]').dataset.status;
      const picked = new Set([...form.querySelectorAll('[data-tag][aria-pressed="true"]')].map(b => b.dataset.tag));
      const tagBox = form.querySelector("[data-tags]");
      const drawTags = () => tagBox.querySelectorAll("[data-tag]").forEach(b => b.setAttribute("aria-pressed", String(picked.has(b.dataset.tag))));
      form.querySelectorAll("[data-status]").forEach(b => b.onclick = () => {
        status = b.dataset.status;
        form.querySelectorAll("[data-status]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        form.querySelector("[data-year]").hidden = status !== "completed";
      });
      tagBox.onclick = e => {
        const b = e.target.closest("[data-tag]"); if (!b) return;
        const t = b.dataset.tag;
        if (picked.has(t)) picked.delete(t);
        else if (picked.size >= MAX_PROJECT_TAGS) { toast(`Pick up to ${MAX_PROJECT_TAGS} topics.`); return; }
        else picked.add(t);
        drawTags();
      };
      const sel = form.querySelector("[data-addtopic]");
      sel.onchange = () => {
        const t = sel.value; sel.value = ""; if (!t) return;
        if (!tagBox.querySelector(`[data-tag="${CSS.escape(t)}"]`)) tagBox.insertAdjacentHTML("beforeend", `<button type="button" class="chip sm" data-tag="${esc(t)}">${esc(t)}</button>`);
        if (!picked.has(t)) { if (picked.size >= MAX_PROJECT_TAGS) toast(`Pick up to ${MAX_PROJECT_TAGS} topics.`); else picked.add(t); }
        drawTags();
      };
      form.querySelector("[data-cancel]").onclick = () => { editing = null; draw(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const f = form.elements;
        const title = f.title.value.trim(), summary = f.summary.value.trim(), link = f.link.value.trim();
        if (!title || !summary) { (title ? f.summary : f.title).focus(); return; }
        if (link && !safeLink(link)) { toast("Links need to start with http:// or https://"); f.link.focus(); return; }
        const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
        try {
          const pr = await saveProject(id, { title, summary, status, year: f.year.value, tags: [...picked], private: f.private.checked },
            { details: f.details.value.trim(), link });
          const share = !id && f.share && f.share.checked;
          if (share) await postAboutProject(pr, summary);
          editing = null;
          toast(id ? "Project saved." : share ? "Project added and shared to the feed." : "Project added.");
          await reload();
        } catch (err) { toast(esc(friendlyError(err))); btn.disabled = false; }
      };
    });
  }

  box.addEventListener("click", async e => {
    const btn = e.target.closest("[data-act]"); if (!btn || !box.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === "new") { editing = "new"; draw(); box.querySelector("#pj-title")?.focus(); return; }
    const card = btn.closest("[data-project]"); if (!card) return;
    const pr = list.find(p => p.id === card.dataset.project); if (!pr) return;
    const upd = card.querySelector("[data-update]");
    if (act === "edit") { editing = pr.id; draw(); box.querySelector("#pj-title")?.focus(); }
    else if (act === "update") { upd.hidden = false; upd.querySelector("textarea").focus(); }
    else if (act === "cancel-update") { upd.hidden = true; }
    else if (act === "post-update") {
      const text = upd.querySelector("textarea").value.trim();
      if (!text) { upd.querySelector("textarea").focus(); return; }
      btn.disabled = true;
      try { await postAboutProject(pr, text); upd.hidden = true; upd.querySelector("textarea").value = ""; toast("Update posted to the feed."); }
      catch (err) { toast(esc(friendlyError(err))); }
      btn.disabled = false;
    } else if (act === "privacy") {
      btn.disabled = true;
      try { await setPrivate(pr.id, !pr.private); toast(pr.private ? "Project is public now." : "Project is private now. Others see only the summary."); await reload(); }
      catch (err) { toast(esc(friendlyError(err))); btn.disabled = false; }
    } else if (act === "delete") {
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Delete project and its posts?"; return; }
      btn.disabled = true;
      try { await deleteProject(pr.id); toast("Project deleted."); await reload(); }
      catch (err) { toast(esc(friendlyError(err))); btn.disabled = false; }
    }
  });

  const load = async () => {
    const prs = await projectsOf(uid);
    return { prs, ds: await detailsFor(prs.map(p => p.id)) };
  };
  const apply = ({ prs, ds }) => {
    list = prs; details = ds; error = "";
    onCount && onCount(prs.length);
    // Don't wipe a form someone is typing in.
    if (!box.querySelector("[data-form]")) draw();
  };
  const reload = async () => { apply(await load()); if (box.querySelector("[data-form]") && !editing) draw(); };

  draw();
  const unsub = live(["projects"], load, apply, e => { error = friendlyError(e); draw(); });
  return () => unsub();
}
