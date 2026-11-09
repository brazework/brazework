"use server";
import { after } from "next/server";
import { announceEvent } from "@/lib/connectors/announce";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EVENT_FORMATS, EVENT_TYPES, INDUSTRIES, ORG_SIZES } from "@/lib/events";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

export type OrgState = { ok: boolean; message: string };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// create_organization() verifies the account's confirmed email matches the website's domain.
export async function registerOrganization(_: OrgState, form: FormData): Promise<OrgState> {
  const type = str(form.get("type"));
  const name = str(form.get("name"));
  if (type !== "company" && type !== "school") return { ok: false, message: "Choose company or school." };
  if (name.length < 2 || name.length > 120) return { ok: false, message: "Enter your organization's name." };
  const industries = form.getAll("industries").map(String).filter((i) => (INDUSTRIES as readonly string[]).includes(i)).slice(0, 14);
  const size = str(form.get("size"));
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("create_organization", {
    p_type: type, p_name: name, p_website: str(form.get("website")), p_location: str(form.get("location")).slice(0, 160),
    p_size: (ORG_SIZES as readonly string[]).includes(size) ? size : "", p_industries: industries,
  });
  if (error) return { ok: false, message: error.code === "P0001" || error.code === "42501" ? error.message : friendlyError(error) };
  revalidatePath("/org");
  revalidatePath("/events");
  return { ok: true, message: "Organization registered." };
}

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Give the event a title.").max(120),
    description: z.string().trim().max(2000),
    type: z.enum(EVENT_TYPES),
    format: z.enum(EVENT_FORMATS),
    location: z.string().trim().max(160),
    link: z.string().trim().max(300).refine((l) => l === "" || /^https?:\/\//.test(l), "Links must start with http:// or https://"),
    topic: z.string().refine((t) => ALL_TOPICS.includes(t), "Pick a topic."),
    starts_at: z.iso.datetime({ offset: true, message: "Pick a start time." }),
    ends_at: z.iso.datetime({ offset: true, message: "Pick an end time." }),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), { message: "The event has to end after it starts." })
  .refine((v) => v.format === "Online" || v.location, { message: "Add where it happens." });

// Times arrive as exact moments: the browser converts its local date picker values before sending.
export async function saveEvent(_: OrgState, form: FormData): Promise<OrgState> {
  const parsed = eventSchema.safeParse(Object.fromEntries(["title", "description", "type", "format", "location", "link", "topic", "starts_at", "ends_at"].map((k) => [k, str(form.get(k))])));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const id = str(form.get("id"));
  const orgId = str(form.get("org_id"));
  const communityId = str(form.get("community_id"));
  // Exactly one host: a verified organization or a club (supabase/club-events.sql).
  const host = communityId ? { community_id: communityId } : orgId ? { org_id: orgId } : null;
  if (!id && !host) return { ok: false, message: "Choose who's hosting this event." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = id
    ? await supabase.from("events").update(parsed.data).eq("id", id).select("id")
    : await supabase.from("events").insert({ ...parsed.data, ...host }).select("id");
  if (error) return { ok: false, message: error.code === "42501" ? "Only a club's admins and owner can host its events." : friendlyError(error) };
  if (!data?.length) return { ok: false, message: "Ended events can't be edited." };
  revalidatePath("/org");
  if (communityId) revalidatePath(`/c/${communityId}`);
  // A new club event is announced in the club's Discord, if connected, after the response.
  const newId = data[0]?.id as string | undefined;
  if (!id && communityId && newId) after(() => announceEvent(supabase, communityId, newId, parsed.data));
  revalidatePath("/events", "layout");
  return { ok: true, message: id ? "Event updated." : "Event published." };
}

export async function cancelEvent(id: string): Promise<OrgState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("events").update({ status: "cancelled" }).eq("id", id).select("id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You don't have permission to do that." };
  revalidatePath("/org");
  revalidatePath("/events", "layout");
  revalidatePath("/c/[id]", "page");
  return { ok: true, message: "Event cancelled." };
}
