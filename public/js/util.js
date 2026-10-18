// Small shared helpers.

// Escape text before putting it in HTML so member content can never inject code.
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function initials(first, last) {
  return ((first || "").trim().charAt(0) + (last || "").trim().charAt(0)).toUpperCase() || "?";
}

export function fullName(p) { return p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : ""; }

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ACADEMIC_RE = /@([a-z0-9-]+\.)*([a-z0-9-]+\.edu(\.[a-z]{2})?|[a-z0-9-]+\.ac\.[a-z]{2})$/i;

export function ageFrom(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d)) return -1;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export function timeAgo(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Turns Firebase's error codes into plain sentences.
export function friendlyError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/email-already-in-use": "An account with that email already exists. Try logging in.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Choose a password with at least 8 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Can't reach Forge right now. Check your connection.",
    "permission-denied": "You don't have permission to do that.",
    "not-found": "That post was removed.",
    "failed-precondition": "The database needs a one-time setup step (an index). See SETUP.md, step 7."
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
}

export function toast(html, ms = 5000) {
  const host = document.getElementById("overlay");
  host.querySelectorAll(".toast").forEach(t => t.remove()); // one message at a time
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex:0 0 auto"></span><span>${html}</span><button class="btn ghost" style="min-height:32px;padding:0 8px" aria-label="Dismiss">×</button>`;
  el.querySelector("button").onclick = () => el.remove();
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export const LOGO = `<svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="var(--accent)" stroke-width="2" aria-hidden="true"><path d="M4 22 L14 4 L24 22 Z"/><path d="M9 22 L14 13 L19 22"/></svg>`;

export const ICONS = {
  menu: "M3 5 H17 M3 10 H17 M3 15 H12",
  home: "M3 9 L10 3 L17 9 V17 H12 V12 H8 V17 H3 Z",
  user: "M10 10 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 1 0 0 7 Z M3 17 C3 13.5 6 12 10 12 C14 12 17 13.5 17 17",
  groups: "M10 8.5 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z M4.5 11 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 Z M15.5 11 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 Z M5.5 17 C5.5 13.5 7.5 12 10 12 C12.5 12 14.5 13.5 14.5 17",
  network: "M6 8 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z M14 8 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z M1.5 16 C1.5 12.5 3.5 11 6 11 C8.5 11 10 12.5 10 16 M10 16 C10 12.5 11.5 11 14 11 C16.5 11 18.5 12.5 18.5 16",
  chat: "M3 4 H17 V13 H9 L5 16.5 V13 H3 Z",
  calendar: "M3 5 H17 V17 H3 Z M3 9 H17 M7 3 V6 M13 3 V6",
  saved: "M5 3 H15 V17 L10 13.5 L5 17 Z",
  chart: "M3 17 H17 M5 14 V10 M9 14 V5 M13 14 V8",
  market: "M3 7 H17 L16 17 H4 Z M7 7 V5 a3 3 0 0 1 6 0 V7",
  gear: "M10 12.5 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 1 0 0 5 Z M10 2 V4 M10 16 V18 M2 10 H4 M16 10 H18 M4.3 4.3 L5.7 5.7 M14.3 14.3 L15.7 15.7 M4.3 15.7 L5.7 14.3 M14.3 5.7 L15.7 4.3",
  logout: "M8 3 H4 V17 H8 M13 6 L17 10 L13 14 M17 10 H8",
  heart: "M10 16.5 C4 12.5 2.5 9.5 2.5 7.2 C2.5 5 4.2 3.5 6.2 3.5 C7.8 3.5 9.2 4.4 10 5.8 C10.8 4.4 12.2 3.5 13.8 3.5 C15.8 3.5 17.5 5 17.5 7.2 C17.5 9.5 16 12.5 10 16.5 Z",
  comment: "M3 4 H17 V13 H9 L5 16.5 V13 H3 Z",
  tag: "M3 3 H10 L17 10 L10 17 L3 10 Z M6.5 6.5 h0.01"
};
export const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// Starter topic list (replace with the curated list later).
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
  { name: "Space Science", topics: ["Astrophysics", "Planetary Science", "Space Systems", "Cosmology"] }
];
export const FIELDS = TOPICS.map(t => t.name);
