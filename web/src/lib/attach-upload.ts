"use client";
import { extOf, storedType } from "@/lib/project-file-types";
import { storageUpload } from "@/lib/storage-upload";
import { addProjectLink, recordProjectFile } from "@/lib/project-files";
import { addPostLink, recordPostFile } from "@/lib/post-files";

export type PendingFile = { key: string; file: File; name: string };

// Uploads files and links to a project, each tied to one of its updates (`postId`), the same way for
// a new update (post-update.tsx) and for one being edited (feed/edit-post.tsx, FIX-238). Big files go
// up resumably with progress (lib/storage-upload.ts). Returns the names of the ones that didn't make it.
export async function uploadAttachments({ projectId, postId, files, links, onStep }: { projectId: string; postId?: string; files: PendingFile[]; links: string[]; onStep: (s: string) => void }) {
  const failed: string[] = [];
  for (const [i, p] of files.entries()) {
    const label = `Uploading ${i + 1} of ${files.length}`;
    onStep(`${label}…`);
    const path = `${projectId}/${p.key}.${extOf(p.name)}`;
    const up = await storageUpload({ bucket: "project-files", path, file: p.file, contentType: storedType(p.name), onProgress: (f) => onStep(`${label}: ${Math.round(f * 100)}%`) }).then(() => true, () => false);
    const rec = up ? await recordProjectFile(projectId, path, p.name, p.file.size, postId) : { ok: false };
    if (!rec.ok) failed.push(p.name);
  }
  for (const l of links) { const a = await addProjectLink(projectId, l, postId); if (!a.ok) failed.push(l); }
  return failed;
}

// The same for a post that isn't a project update (supabase/post-files.sql): files go to the
// "post-files" bucket under "<post id>/<random>.<ext>", tied to that post.
export async function uploadPostAttachments({ postId, files, links, onStep }: { postId: string; files: PendingFile[]; links: string[]; onStep: (s: string) => void }) {
  const failed: string[] = [];
  for (const [i, p] of files.entries()) {
    const label = `Uploading ${i + 1} of ${files.length}`;
    onStep(`${label}…`);
    const path = `${postId}/${p.key}.${extOf(p.name)}`;
    const up = await storageUpload({ bucket: "post-files", path, file: p.file, contentType: storedType(p.name), onProgress: (f) => onStep(`${label}: ${Math.round(f * 100)}%`) }).then(() => true, () => false);
    const rec = up ? await recordPostFile(postId, path, p.name, p.file.size) : { ok: false };
    if (!rec.ok) failed.push(p.name);
  }
  for (const l of links) { const a = await addPostLink(postId, l); if (!a.ok) failed.push(l); }
  return failed;
}
