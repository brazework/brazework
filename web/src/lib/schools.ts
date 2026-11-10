"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { createClient } from "@/lib/supabase/server";

// "Request my school" (supabase/school-requests.sql): anyone can ask; Brazework admins decide.
export type SchoolState = { ok: boolean; message: string; listed?: boolean };

export async function requestSchool(_: SchoolState, form: FormData): Promise<SchoolState> {
  const domain = String(form.get("domain") ?? "").trim().slice(0, 120);
  const school = String(form.get("school") ?? "").trim().slice(0, 160);
  const contact = String(form.get("contact") ?? "").trim().slice(0, 200);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_school", { p_domain: domain, p_school: school, p_contact: contact });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : friendlyError(error) };
  if (data === "listed") return { ok: true, listed: true, message: "Good news: that school is already recognized. Go back and sign up with your school email." };
  return { ok: true, message: "Requested. The Brazework team checks it's a real school, then you can sign up with that email." };
}

export async function decideSchool(id: number, add: boolean): Promise<SchoolState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_school_request", { p_id: id, p_add: add });
  if (error) return { ok: false, message: error.code === "P0001" || error.code === "42501" ? error.message : friendlyError(error) };
  revalidatePath("/admin");
  return { ok: true, message: add ? "Added." : "Dismissed." };
}
