"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_TOPICS, FIELDS, ageFrom, friendlyError } from "@/lib/forge";
import { dbFeatures } from "@/lib/db-features";
import { signupGoalFrom } from "@/lib/goals";
import { joinRememberedInvite } from "@/lib/invites";
import { LINKEDIN_ADD_HERE, cleanLinkedin } from "@/lib/linkedin";
import { needsLinkedin, saveLinkedinFrom } from "@/lib/linkedin-gate";
import { parseGradYear } from "@/lib/profile-meta";
import { getViewer } from "@/lib/supabase/server";
import { cleanBuild, firstHeadline, starterInterests } from "@/lib/front-door";
import { addMilestone } from "@/lib/milestones";
import { startProject } from "@/lib/projects";
import { RELATIONSHIPS } from "@/lib/vouch-email";
import { joinCommunity } from "../(app)/communities/actions";

export type OnboardState = { message: string };
export type FinishState = { message: string; school?: boolean };

// Someone who signed up with Google, GitHub or LinkedIn gives what the sign-up form asks for.
// The database applies the same rules as for an email sign-up (finish_signup() in
// supabase/oauth-signup.sql: minimum age, a school email for a student account); this only
// catches the obvious before the round trip.
const finishSchema = z
  .object({
    accountType: z.enum(["student", "professional"], { error: "Choose student or professional." }),
    firstName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    lastName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    birthday: z.string(),
  })
  .superRefine((v, ctx) => {
    const age = ageFrom(v.birthday);
    if (age < 0) ctx.addIssue({ code: "custom", message: "Enter your birthday." });
    else if (age < 18) ctx.addIssue({ code: "custom", message: "You must be at least 18 to create an account." });
  });

export async function finishSignup(_: FinishState, form: FormData): Promise<FinishState> {
  const parsed = finishSchema.safeParse({ accountType: form.get("accountType"), firstName: form.get("firstName") ?? "", lastName: form.get("lastName") ?? "", birthday: form.get("birthday") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (profile) redirect("/onboarding");
  const { accountType, firstName, lastName, birthday } = parsed.data;
  const args = { p_account_type: accountType, p_first_name: firstName, p_last_name: lastName, p_birthday: birthday };
  // A professional may give a LinkedIn link here, once supabase/linkedin-required.sql has run. It
  // is optional (they need it later, to ask someone to sign); one that isn't a LinkedIn profile is
  // said so before the round trip.
  let linkedin: string | null | undefined;
  if (accountType === "professional" && (await dbFeatures()).linkedinRequired) {
    const link = cleanLinkedin(form.get("linkedin"));
    if (!link.ok) return { message: link.message };
    linkedin = link.url;
  }
  const { error } = linkedin ? await supabase.rpc("finish_signup", { ...args, p_linkedin: linkedin }) : await supabase.rpc("finish_signup", args);
  if (error) {
    const message = error.code === "P0001" ? error.message : friendlyError(error);
    return { message, school: /university email/.test(message) };
  }
  // Where they're headed, if they said (optional; private until they choose otherwise). A goal that
  // can't be saved never stops sign-up: Ember offers to set one later.
  const goal = signupGoalFrom(form.get("goalKind"), form.get("goalTarget"), accountType);
  if (goal && (await dbFeatures()).goals) await supabase.rpc("set_goal", { p_kind: goal.kind, p_target: goal.target, p_visible: false });
  redirect("/onboarding");
}

const schema = z.object({
  headline: z.string().trim().min(1, "Add your major or profession.").max(200),
  field: z.string().refine((f) => FIELDS.includes(f), "Pick your field."),
  interests: z.array(z.string().refine((t) => ALL_TOPICS.includes(t))).min(3, "Pick at least 3 interests.").max(100),
});

export async function completeOnboarding(_: OnboardState, form: FormData): Promise<OnboardState> {
  const parsed = schema.safeParse({ headline: form.get("headline"), field: form.get("field"), interests: form.getAll("interests") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const row: Record<string, unknown> = { ...parsed.data, onboarded: true };
  // Sent only to students, once supabase/grad-year.sql has run.
  if (form.has("grad_year")) {
    const year = parseGradYear(form.get("grad_year"));
    if (!year.ok) return { message: "Pick a graduation year from the list." };
    row.grad_year = year.value;
  }
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  // Signed up with a provider and hasn't finished: that comes first (there's no profile to update).
  if (!profile) redirect("/onboarding");
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) return { message: friendlyError(error) };
  // Came in through a club invite link: land in that club.
  // Otherwise a student finds their club next (its officers verify their work), before the feed.
  // Someone already working may not have one, so they go straight to Today, which starts with their
  // work and a person who saw it (lib/guide-steps.ts). Clubs are still one tap away, under Club.
  redirect((await joinRememberedInvite()) ?? (profile?.account_type === "professional" ? "/feed" : "/onboarding/club"));
}

// Build-first onboarding (docs/superpowers/specs/2026-11-19-product-hunt-launch-design.md): the three
// screens after About you (what you built, its proof, who saw it) are saved here at once, because a
// milestone's evidence can't be changed after it's saved. Every rule is the app's own: startProject,
// addMilestone (evidence, backing, the vouch guards and email, the club's membership) and, with no
// proof or nobody to ask, a draft. If the ask fails, the project id comes back so a retry doesn't
// start a second project.
export type FirstBuildSigner = { kind: "none" } | { kind: "email"; email: string; relationship: string } | { kind: "club"; clubId: string };
// linkedin: a working account with no LinkedIn link gives it on the last screen, to ask by email.
export type FirstBuildInput = { text: string; field: string; achievedOn: string; evidence: string; signer: FirstBuildSigner; projectId?: string; linkedin?: string };
export type FirstBuildResult = { ok: false; message: string; projectId?: string; step?: "build" | "proof" | "signer" };

const today = () => new Date().toISOString().slice(0, 10);
const firstBuild = z.object({
  text: z.string().transform(cleanBuild).refine((t) => t.length >= 3, "Say what you built, in a few words."),
  field: z.string().refine((f) => FIELDS.includes(f), "Pick your field."),
  achievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it happened.").refine((d) => d <= today(), "Pick a date that has already happened."),
  evidence: z.string().trim().max(300).refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "Proof has to be a secure web link (https://…)."),
  signer: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("email"), email: z.string().trim().toLowerCase().email("Enter their email address.").max(254), relationship: z.enum(Object.keys(RELATIONSHIPS) as [string, ...string[]], { message: "Pick how they know your work." }) }),
    z.object({ kind: z.literal("club"), clubId: z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "Pick a club.") }),
  ]),
  projectId: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).optional(),
  linkedin: z.string().max(200).optional(),
});

export async function finishFirstBuild(input: FirstBuildInput): Promise<FirstBuildResult> {
  const v = firstBuild.safeParse(input);
  if (!v.success) {
    const issue = v.error.issues[0];
    const at = issue?.path[0];
    return { ok: false, message: issue?.message ?? "Check the form.", step: at === "signer" ? "signer" : at === "evidence" ? "proof" : "build", projectId: input.projectId };
  }
  const d = v.data;
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  // Asking a person to sign: a working account adds its LinkedIn link first (the database holds
  // the rule). Checked before anything is saved, so a missing or wrong link starts no project.
  if (d.evidence !== "" && d.signer.kind === "email") {
    const bad = await saveLinkedinFrom(supabase, d.linkedin);
    if (bad) return { ok: false, message: bad, step: "signer", projectId: input.projectId };
    if (await needsLinkedin(supabase)) return { ok: false, message: LINKEDIN_ADD_HERE, step: "signer", projectId: input.projectId };
  }

  // A retry after a failed ask reuses the project it already started.
  let projectId = "";
  if (d.projectId) {
    const { data } = await supabase.from("projects").select("id").eq("id", d.projectId).eq("owner_id", user.id).maybeSingle();
    projectId = data?.id ?? "";
  }
  if (!projectId) {
    const started = await startProject(d.text);
    if (!started.ok || !started.id) return { ok: false, message: started.message, step: "build" };
    projectId = started.id;
  }

  // Joining through an invite link happens now, so that club can be the one asked.
  await joinRememberedInvite();

  const title = d.text.length <= 120 ? d.text : `${d.text.slice(0, 117).replace(/\s+\S*$/, "")}...`;
  const asking = d.evidence !== "" && d.signer.kind !== "none";
  let milestoneId: string | undefined;
  if (asking) {
    if (d.signer.kind === "club") {
      const { data: member } = await supabase.from("community_members").select("community_id").eq("community_id", d.signer.clubId).eq("uid", user.id).maybeSingle();
      if (!member) {
        const joined = await joinCommunity(d.signer.clubId);
        if (!joined.ok) return { ok: false, message: joined.message, step: "signer", projectId };
        if (joined.state !== "member") return { ok: false, message: "That club approves new members first. Your request is in; ask someone by email for now, or finish and send it to the club once you're in.", step: "signer", projectId };
      }
    }
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("verifyBy", d.signer.kind === "club" ? "club" : "vouch");
    form.set("communityId", d.signer.kind === "club" ? d.signer.clubId : "");
    form.set("vouchEmail", d.signer.kind === "email" ? d.signer.email : "");
    form.set("vouchRelationship", d.signer.kind === "email" ? d.signer.relationship : "");
    form.set("title", title);
    form.set("detail", "");
    form.set("evidence", d.evidence);
    form.set("achievedOn", d.achievedOn);
    form.set("showOnProfile", "on");
    const r = await addMilestone({ ok: false, message: "" }, form);
    if (!r.ok) return { ok: false, message: r.message, step: "signer", projectId };
    milestoneId = r.id;
  } else {
    // Nothing to ask yet: a draft, on the record for its owner, ready for proof and a signer.
    const row = { project_id: projectId, community_id: null, title, detail: "", evidence: d.evidence, achieved_on: d.achievedOn, status: "draft", private: false };
    let { data: saved, error } = await supabase.from("milestones").insert(row).select("id").single();
    if (error && /private/.test(error.message ?? "")) ({ data: saved, error } = await supabase.from("milestones").insert({ ...row, private: undefined }).select("id").single());
    if (error || !saved) return { ok: false, message: error?.code === "P0001" ? error.message : friendlyError(error ?? {}), step: "proof", projectId };
    milestoneId = saved.id;
  }
  // Last, so the onboarding page (which re-renders when a step above revalidates) stays on the
  // wizard until everything is saved, and a retry still finds it.
  if (!profile.onboarded) {
    const { error } = await supabase.from("profiles").update({
      headline: profile.headline?.trim() || firstHeadline(d.field, profile.account_type !== "professional"),
      field: d.field, interests: starterInterests(d.field), onboarded: true,
    }).eq("id", user.id);
    if (error) return { ok: false, message: friendlyError(error), step: "build", projectId };
  }
  const welcome = new URLSearchParams({ welcome: "1" });
  if (milestoneId) welcome.set("result", milestoneId);
  redirect(`/u/${user.id}?${welcome}`);
}
