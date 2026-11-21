// What Ember knows about a member's record before they type, and the next steps it opens with
// (Linear FIX-216). Pure: the loader (lib/ember-record-load.ts) reads the rows as the member, and this
// turns them into sentences for Ember's instructions and into up to three one-tap steps for a new chat.
// The steps come from the record, not the model, so they are instant, free and the same every time
// (tests/ember-record.test.ts).

export type OpenMilestone = {
  id: string; title: string; project_id: string;
  /** Sent to a club: its officers verify it, so nobody else needs asking. */
  club: boolean;
  /** People asked who haven't answered yet, oldest first. */
  asked: { email: string; days: number }[];
  /** The day it happened, as the member logged it (YYYY-MM-DD); "" when unknown. */
  on: string;
};

/**
 * Newest first by the day on the milestone, so "my latest milestone" has an answer. Two from the
 * same day keep the order they came in (the loaders read newest-logged first); one with no day
 * goes last. Used for what Ember is told up front and for its my_profile tool, so they agree.
 */
export function newestFirst<T extends { on: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.on === b.on ? 0 : a.on < b.on ? 1 : -1));
}

export type EmberRecord = {
  student: boolean;
  /** A working account with no LinkedIn link: the signature card will ask for it. */
  needsLinkedin: boolean;
  projects: { id: string; title: string }[];
  /** Milestones still waiting for proof, newest first. */
  open: OpenMilestone[];
  /** Milestones signed, verified by a club or backed by GitHub. */
  proven: number;
  /** GitHub repos linked to their projects. */
  repos: string[];
  /** Their own merged pull requests that aren't on the record yet, with the project they belong to. */
  unlogged: { project_id: string; count: number } | null;
  /**
   * What they're working toward (supabase/goals.sql): null when they haven't set one; undefined when
   * it isn't known (the step hasn't run, or it couldn't be read), so nothing is offered or assumed.
   */
  goal?: { kind: GoalKind; target: string } | null;
};

export const EMPTY_RECORD: EmberRecord = { student: true, needsLinkedin: false, projects: [], open: [], proven: 0, repos: [], unlogged: null };

/** A reminder is worth offering once an ask has sat this long. */
export const SLOW_DAYS = 5;

import { GOAL_KINDS, goalTitle, nextStep as goalNext, type GoalKind } from "@/lib/goals";

// The goal's path, from what Ember already knows (lib/goals.ts): signed counts the proven, waiting the
// open. Who looked isn't known here, so the path's last stage reads "get found" until it is.
const goalRecord = (r: EmberRecord) => ({ projects: r.projects.length, signed: r.proven, waiting: r.open.length, looked: 0 });

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const days = (n: number) => (n <= 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`);

/** The record as a few sentences for Ember's instructions. Empty when there is nothing to say. */
export function recordLines(r: EmberRecord): string[] {
  const lines: string[] = [];
  if (!r.projects.length) lines.push("They have no project yet: a result needs one, so prepare it first with propose_project.");
  if (r.proven) lines.push(`Milestones signed, verified or backed so far: ${r.proven}.`);
  if (r.open.length) {
    const each = r.open.slice(0, 6).map((m) => {
      const who = m.club ? "with a club's officers" : m.asked.length ? m.asked.map((a) => `asked ${a.email} ${days(a.days)}, no answer yet`).join("; ") : "nobody asked yet";
      return `"${cut(m.title, 90)}" (${m.on ? `${m.on}; ` : ""}milestone id ${m.id}; ${who})`;
    });
    lines.push(`Waiting for proof, newest first by the day each happened: ${each.join("; ")}${r.open.length > 6 ? `; and ${r.open.length - 6} more` : ""}. To ask a person about one of these, pass its milestone id to propose_signature.`);
  }
  if (r.repos.length) lines.push(`GitHub repos linked to their projects: ${r.repos.slice(0, 5).join(", ")}.`);
  if (r.unlogged?.count) lines.push(`${r.unlogged.count} of their own merged pull requests from the last 90 days aren't on their record yet; they add them in one tap on the project page, /projects/${r.unlogged.project_id}.`);
  if (r.goal) {
    const k = GOAL_KINDS[r.goal.kind];
    lines.push(`Their goal: ${goalTitle(r.goal)}. On the path: ${Math.min(r.proven, k.target)} of ${k.target} milestones signed (by ${k.signers})${r.open.length ? `, ${r.open.length} waiting` : ""}. The next step on it: ${goalNext(r.goal, goalRecord(r)).text} Tie your suggestions to this goal.`);
  } else if (r.goal === null) {
    lines.push(`They haven't set a goal yet. ${r.student ? "For a student" : "For someone working"}, a goal points everything Ember suggests somewhere: when it fits (they ask what to do next, or about their career), ask what they're working toward in one question and offer it with propose_goal. Don't push it into unrelated answers.`);
  }
  if (r.needsLinkedin) lines.push("They haven't added a LinkedIn profile link yet. A working account adds one before asking a person to sign; the signature card asks for it, so don't ask for it yourself.");
  return lines;
}

/**
 * One step a new chat offers. `text` is what the member asks Ember when they tap it (with `finish`,
 * the sentence is started and waits for them to complete it); `href` opens a page instead, for a step
 * that isn't Ember's to do.
 */
export type NextStep = { id: "continue" | "goal" | "set-goal" | "first-project" | "slow" | "unsigned" | "unlogged" | "first-result"; label: string; hint: string } & ({ text: string; finish?: string } | { href: string });

/** Up to three steps from the member's own record, most useful first. None when the record is in order. */
export function nextSteps(r: EmberRecord): NextStep[] {
  const steps: NextStep[] = [];
  if (!r.projects.length) {
    steps.push({ id: "first-project", label: "Add your first project", hint: "Paste a GitHub link, or say what you built.", text: "Help me add my first project. I built ", finish: "Say what you built, or paste a GitHub link. Ember drafts the project for you to check." });
    return steps;
  }
  // Their goal leads: where they're going, and the next step on the way (lib/goals.ts). With none set
  // (and it's known there's none), the first step is choosing one.
  if (r.goal) {
    const k = GOAL_KINDS[r.goal.kind];
    const signed = Math.min(r.proven, k.target);
    steps.push({ id: "goal", label: signed >= k.target ? `Ready for ${goalTitle(r.goal)}` : `Toward ${goalTitle(r.goal)}: ${signed} of ${k.target} signed`, hint: goalNext(r.goal, goalRecord(r)).text, text: "Plan my next steps toward my goal, from my record." });
  } else if (r.goal === null) {
    steps.push({ id: "set-goal", label: "Set what you're working toward", hint: r.student ? "An internship, grad school, a research lab, your first job. Ember points everything at it." : "Your next role, funding for what you build. Ember points everything at it.", text: "Help me choose what to work toward. ", finish: "Say where you'd like to be in a year, or what you're unsure about." });
  }
  // Someone was asked and hasn't answered: the record is stuck on them.
  const slow = r.open.flatMap((m) => m.asked.filter((a) => a.days >= SLOW_DAYS).map((a) => ({ m, a }))).sort((x, y) => y.a.days - x.a.days)[0];
  if (slow) steps.push({ id: "slow", label: `${slow.a.email} hasn't answered in ${slow.a.days} days`, hint: `About "${cut(slow.m.title, 70)}". Ask someone else who saw it.`, text: `${slow.a.email} hasn't answered about "${slow.m.title}". Help me ask someone else who saw it to sign it.` });
  // Logged, but nobody has been asked and no club has it.
  const bare = r.open.filter((m) => !m.club && !m.asked.length);
  if (bare.length) steps.push({ id: "unsigned", label: bare.length === 1 ? `"${cut(bare[0].title, 60)}" has no signature yet` : `${bare.length} milestones have no signature yet`, hint: "Ask the person who saw it. One email, and they don't need an account.", text: `Help me ask someone who saw "${bare[0].title}" to sign it.` });
  if (r.unlogged?.count) steps.push({ id: "unlogged", label: r.unlogged.count === 1 ? "1 merged pull request isn't on your record" : `${r.unlogged.count} merged pull requests aren't on your record`, hint: "Add them from the project page. GitHub backs each one, so nobody has to sign.", href: `/projects/${r.unlogged.project_id}` });
  // A project with nothing on it yet.
  if (!r.proven && !r.open.length) steps.push({ id: "first-result", label: "Log your first result", hint: "One thing you finished, with a number if you have one.", text: "Today I ", finish: "Say what you finished, with a number if you have one. Ember turns it into a milestone for you to check." });
  return steps.slice(0, 3);
}
