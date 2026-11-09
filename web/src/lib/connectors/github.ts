import { ALL_TOPICS } from "@/lib/forge";

// GitHub connector: public repositories and profiles through GitHub's REST API. No member login
// needed; GITHUB_TOKEN (optional, server-only) raises the rate limit from 60 to 5,000 an hour.
// Used by "Import from GitHub" on projects and by Copilot's github_* tools.

const API = "https://api.github.com";
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export class GitHubError extends Error {}

// "owner/repo", or any github.com URL pointing into a repo (tree, blob, .git and so on).
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/\.git$/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i) ?? s.match(/^([^/\s]+)\/([^/\s#?]+)$/);
  if (!m || !NAME.test(m[1]) || !REPO.test(m[2])) return null;
  return { owner: m[1], repo: m[2] };
}

export function parseUser(input: string): string | null {
  const s = input.trim().replace(/^@/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/?$/i);
  const u = m ? m[1] : s;
  return NAME.test(u) ? u : null;
}

async function gh<T>(path: string, accept = "application/vnd.github+json"): Promise<T> {
  const headers: Record<string, string> = { Accept: accept, "User-Agent": "forge-app", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new GitHubError("GitHub didn't answer. Try again in a moment.");
  }
  if (res.status === 404) throw new GitHubError("That repository or user doesn't exist, or it's private.");
  if (res.status === 403 || res.status === 429) throw new GitHubError("GitHub's rate limit was reached. Try again in a few minutes.");
  if (!res.ok) throw new GitHubError(`GitHub answered ${res.status}.`);
  return (accept.includes("raw") ? await res.text() : await res.json()) as T;
}

// README to plain text: no badges, images, HTML or link syntax; first ~2,500 characters.
export function readmeText(md: string, max = 2500) {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

// Common GitHub topics and languages, mapped onto the nearest Forge topic.
const ALIASES: Record<string, string> = Object.fromEntries(Object.entries({
  "Machine Learning": ["machine-learning", "deep-learning", "ml", "pytorch", "tensorflow", "scikit-learn", "neural-network", "jupyter notebook"],
  "Large Language Models": ["llm", "llms", "gpt", "langchain", "transformers", "rag", "openai", "anthropic"],
  "Computer Vision": ["computer-vision", "opencv", "yolo", "image-processing", "object-detection"],
  "Robotics & Autonomy": ["robotics", "ros", "ros2", "autonomous", "drone", "slam", "px4", "ardupilot"],
  "Data Engineering": ["data-engineering", "etl", "spark", "sql", "database", "airflow", "dbt"],
  "Cybersecurity": ["security", "cybersecurity", "ctf", "pentest", "infosec", "cryptography"],
  "Distributed Systems": ["distributed-systems", "kubernetes", "cloud", "microservices", "docker"],
  "Programming Languages": ["compiler", "interpreter", "programming-language", "parser"],
  "Human-Computer Interaction": ["ui", "ux", "hci", "accessibility", "design-system"],
  "Embedded Systems": ["embedded", "firmware", "arduino", "esp32", "stm32", "rtos", "microcontroller", "c", "c++", "verilog", "vhdl"],
  "Mechanical Design": ["cad", "solidworks", "fusion360", "onshape", "mechanical"],
  "Manufacturing & 3D Printing": ["3d-printing", "cnc", "manufacturing"],
  "Aerospace": ["aerospace", "rocketry", "rocket", "uav", "satellite", "cubesat"],
  "Quantum Computing": ["quantum", "qiskit", "quantum-computing"],
  "Bioinformatics": ["bioinformatics", "genomics", "biopython"],
  "Renewable Energy": ["solar", "renewable-energy", "battery"],
  "Software Engineering": ["cli", "web", "api", "react", "nextjs", "typescript", "javascript", "rust", "go", "python", "java", "kotlin", "swift", "ruby", "php", "c#"],
}).flatMap(([topic, keys]) => keys.map((k) => [k, topic])));

// GitHub topics and languages to Forge topics (exact names first, then aliases), up to 3.
export function matchTopics(words: string[]) {
  const lower = new Map(ALL_TOPICS.map((t) => [t.toLowerCase(), t]));
  const out: string[] = [];
  for (const w of words) {
    const k = w.toLowerCase();
    const hit = lower.get(k.replace(/-/g, " ")) ?? ALIASES[k];
    if (hit && ALL_TOPICS.includes(hit) && !out.includes(hit)) out.push(hit);
    if (out.length === 3) break;
  }
  return out;
}

export type RepoSummary = {
  name: string; full_name: string; url: string; description: string; homepage: string;
  stars: number; forks: number; language: string; languages: string[]; topics: string[];
  created_at: string; pushed_at: string; archived: boolean;
  readme: string;
  releases: { name: string; tag: string; date: string; url: string }[];
  commits: { message: string; date: string; url: string }[];
};

export async function fetchRepo(owner: string, repo: string): Promise<RepoSummary> {
  type R = { name: string; full_name: string; html_url: string; description: string | null; homepage: string | null; stargazers_count: number; forks_count: number; language: string | null; topics?: string[]; created_at: string; pushed_at: string; archived: boolean };
  const r = await gh<R>(`/repos/${owner}/${repo}`);
  const [langs, readme, releases, commits] = await Promise.all([
    gh<Record<string, number>>(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
    gh<string>(`/repos/${owner}/${repo}/readme`, "application/vnd.github.raw+json").catch(() => ""),
    gh<{ name: string | null; tag_name: string; published_at: string; html_url: string; draft: boolean }[]>(`/repos/${owner}/${repo}/releases?per_page=6`).catch(() => []),
    gh<{ html_url: string; commit: { message: string; author: { date: string } | null } }[]>(`/repos/${owner}/${repo}/commits?per_page=8`).catch(() => []),
  ]);
  return {
    name: r.name, full_name: r.full_name, url: r.html_url, description: r.description ?? "", homepage: r.homepage ?? "",
    stars: r.stargazers_count, forks: r.forks_count, language: r.language ?? "",
    languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l),
    topics: r.topics ?? [], created_at: r.created_at, pushed_at: r.pushed_at, archived: r.archived,
    readme: readmeText(readme),
    releases: releases.filter((x) => !x.draft).map((x) => ({ name: x.name || x.tag_name, tag: x.tag_name, date: x.published_at?.slice(0, 10) ?? "", url: x.html_url })),
    commits: commits.map((c) => ({ message: c.commit.message.split("\n")[0].slice(0, 120), date: c.commit.author?.date?.slice(0, 10) ?? "", url: c.html_url })),
  };
}

export async function fetchUser(username: string) {
  type U = { login: string; name: string | null; bio: string | null; html_url: string; public_repos: number; followers: number; blog: string | null };
  type Repo = { name: string; full_name: string; description: string | null; html_url: string; language: string | null; stargazers_count: number; pushed_at: string; fork: boolean };
  const [u, repos] = await Promise.all([gh<U>(`/users/${username}`), gh<Repo[]>(`/users/${username}/repos?sort=pushed&per_page=12`)]);
  return {
    login: u.login, name: u.name ?? "", bio: u.bio ?? "", url: u.html_url, public_repos: u.public_repos, followers: u.followers,
    repos: repos.filter((r) => !r.fork).slice(0, 10).map((r) => ({ repo: r.full_name, description: (r.description ?? "").slice(0, 160), language: r.language ?? "", stars: r.stargazers_count, last_push: r.pushed_at.slice(0, 10), url: r.html_url })),
  };
}

// A Forge project draft from a repo: what "Import from GitHub" fills in.
export type ProjectDraft = { title: string; summary: string; details: string; link: string; tags: string[]; status: "in_progress" | "completed"; year: string; milestones: { title: string; date: string; evidence: string }[] };

export function repoToDraft(r: RepoSummary): ProjectDraft {
  const title = r.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);
  const firstPara = r.readme.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).find((p) => p.length > 40) ?? "";
  const summary = (r.description || firstPara || `${title}, built in ${r.language || "code"}.`).slice(0, 600);
  const stale = Date.now() - Date.parse(r.pushed_at) > 180 * 864e5;
  const completed = r.archived || (stale && r.releases.length > 0);
  const details = [
    r.readme.slice(0, 2000),
    "",
    `Built with ${r.languages.join(", ") || r.language || "—"}. ${r.stars} star${r.stars === 1 ? "" : "s"} on GitHub.`,
    r.releases.length ? `Releases: ${r.releases.map((x) => `${x.name} (${x.date})`).join(", ")}.` : "",
  ].filter(Boolean).join("\n").slice(0, 5000);
  return {
    title, summary, details, link: r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : r.url,
    tags: matchTopics([...r.topics, ...r.languages]),
    status: completed ? "completed" : "in_progress",
    year: completed ? r.pushed_at.slice(0, 4) : "",
    milestones: r.releases.slice(0, 4).map((x) => ({ title: `Released ${x.name}`.slice(0, 120), date: x.date, evidence: x.url })),
  };
}
