import type { MediaItem } from "./media";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

// Ported from public/js/util.js so both apps validate identically.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ACADEMIC_RE = /@([a-z0-9-]+\.)*([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$/i;
export const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];

export function ageFrom(iso: string) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export const initials = (first = "", last = "") => `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";

export function timeAgo(ts: string) {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(ts)) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "user_already_exists" || /already registered/i.test(msg)) return "An account with that email already exists. Try logging in.";
  if (code === "invalid_credentials" || /invalid login/i.test(msg)) return "That email and password don't match.";
  if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) return "Confirm your email first. Check your inbox for the link.";
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg)) return "Too many emails were sent just now. Wait a minute and try again.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code === "42501" || /row-level security|permission/i.test(msg)) return "You don't have permission to do that.";
  return msg || "Something went wrong. Try again.";
}

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  account_type: "student" | "professional";
  headline: string;
  bio: string;
  field: string;
  interests: string[];
  onboarded: boolean;
  created_at: string;
  avatar_path?: string;
  cover_path?: string;
};

export type Post = {
  id: string;
  author_id: string;
  author_first: string;
  author_last: string;
  author_headline: string;
  body: string;
  kind: "update" | "question" | "result" | "project";
  tags: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  edited_at?: string | null;
  project_id?: string | null;
  community_id?: string | null;
  community_name?: string | null;
  media?: MediaItem[];
  // [{ id, name }] once supabase/mentions.sql has run.
  mentions?: { id: string; name: string }[];
  author?: { avatar_path?: string } | null;
};

// The project card shown inside a project post (Ian's projectBlock() in public/js/projects.js).
export type PostProject = {
  id: string; title: string; status: "in_progress" | "completed"; year: number | null; private: boolean; updated_at: string;
  // Shown under the post (lib/project-posts.ts): what it's built with, its top specs, its club-verified proof.
  tools?: string[]; specs?: { label: string; value: string }[]; verified?: { n: number; clubs: string[] };
};

export const POST_KINDS = [
  { id: "update", label: "Update" },
  { id: "question", label: "Question" },
  { id: "result", label: "Result" },
  { id: "project", label: "Project" },
] as const;

export const TOPICS = [
  { name: "Engineering", topics: ["Mechanical Design", "Electrical & Power Systems", "Civil & Structural", "Aerospace", "Embedded Systems", "Manufacturing & 3D Printing", "Biomedical Devices", "Materials Engineering"] },
  { name: "Computer Science", topics: ["Software Engineering", "Cybersecurity", "Distributed Systems", "Programming Languages", "Human-Computer Interaction", "Theory of Computation"] },
  { name: "Data & AI", topics: ["Machine Learning", "Large Language Models", "Computer Vision", "Robotics & Autonomy", "Data Engineering", "AI Safety"] },
  { name: "Mathematics", topics: ["Algebra", "Topology", "Number Theory", "Probability & Statistics", "Optimization", "Mathematical Logic"] },
  { name: "Physics", topics: ["Quantum Computing", "Condensed Matter", "Particle Physics", "Optics & Photonics", "Fluid Dynamics", "Plasma Physics"] },
  { name: "Chemistry", topics: ["Organic Chemistry", "Materials Chemistry", "Batteries & Electrochemistry", "Catalysis", "Polymers", "Analytical Chemistry"] },
  { name: "Biology & Life Sciences", topics: ["Genomics", "Synthetic Biology", "Neuroscience", "Ecology", "Microbiology", "Bioinformatics"] },
  { name: "Earth & Environment", topics: ["Climate Science", "Renewable Energy", "Geology", "Oceanography", "Hydrology", "Sustainability"] },
  { name: "Health & Medicine", topics: ["Medical Imaging", "Epidemiology", "Pharmacology", "Public Health", "Biomechanics", "Health Tech"] },
  { name: "Space Science", topics: ["Astrophysics", "Planetary Science", "Space Systems", "Cosmology"] },
] as const;

export const FIELDS: string[] = TOPICS.map((t) => t.name);
export const ALL_TOPICS: string[] = TOPICS.flatMap((t) => [...t.topics]);

// The time of the current server request. Server Components render once per request, so reading the
// clock there is intended (the React Compiler lint can't tell a server render from a client re-render).
export const requestTime = () => Date.now();
