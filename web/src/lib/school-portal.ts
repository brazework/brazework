"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { parseEmails, parseFaculty } from "@/lib/school-roster";

// The school portal's actions (supabase/school-portal.sql): faculty start a class and set its roster;
// the school's admins keep its faculty list. The database decides who may do each; these pass the
// words along and refresh Your school.
export type PortalState = { ok: boolean; message: string; id?: string };

const said = (e: { code?: string; message?: string }) => (e.code === "P0001" || e.code === "42501" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function createClass(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("create_class", {
    p_course: String(form.get("course") ?? ""), p_title: String(form.get("title") ?? ""), p_term: String(form.get("term") ?? ""), p_about: "",
  });
  if (error) return { ok: false, message: said(error) };
  const roster = parseEmails(String(form.get("roster") ?? ""));
  if (roster.length) {
    const r = await supabase.rpc("set_class_roster", { p_cid: data as string, p_emails: roster, p_replace: false });
    if (r.error) return { ok: false, message: `The class is made, but the roster wasn't: ${said(r.error)}`, id: data as string };
  }
  revalidatePath("/school");
  return { ok: true, message: roster.length ? `Class started with ${roster.length} ${roster.length === 1 ? "student" : "students"} on the roster.` : "Class started. Add its roster next.", id: data as string };
}

export async function setRoster(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const cid = String(form.get("cid") ?? "");
  const emails = parseEmails(String(form.get("roster") ?? ""));
  if (!emails.length) return { ok: false, message: "Paste the class list or choose a CSV: one email per line, or an email column." };
  const { data, error } = await supabase.rpc("set_class_roster", { p_cid: cid, p_emails: emails, p_replace: form.get("replace") === "on" });
  if (error) return { ok: false, message: said(error) };
  revalidatePath("/school");
  revalidatePath(`/c/${cid}`);
  return { ok: true, message: `Roster saved: ${data} ${data === 1 ? "student" : "students"}. Anyone already on Brazework with that email is in the class now; the rest join when they sign up.` };
}

export async function addFaculty(_: PortalState, form: FormData): Promise<PortalState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const domain = String(form.get("domain") ?? "");
  const rows = parseFaculty(String(form.get("faculty") ?? ""));
  if (!rows.length) return { ok: false, message: "Paste the faculty list or choose a CSV: email, name, title." };
  const { data, error } = await supabase.rpc("add_faculty", { p_domain: domain, p_rows: rows });
  if (error) return { ok: false, message: said(error) };
  revalidatePath("/school");
  const skipped = rows.length - (data as number);
  return { ok: true, message: `${data} faculty on your list.${skipped ? ` ${skipped} skipped: not an email at your school.` : ""}` };
}

export async function removeFaculty(domain: string, email: string): Promise<PortalState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("remove_faculty", { p_domain: domain, p_email: email });
  if (error) return { ok: false, message: said(error) };
  revalidatePath("/school");
  return { ok: true, message: "Removed." };
}
