// Proof from any tool (Linear FIX-235): a link a member gives as proof, named for what it is and the
// tool it's from, so a signer, a club officer or a visitor sees "Figma design" or "Onshape CAD model"
// instead of a bare address. GitHub is one source among many: every field has the tools it builds with.
// Pure and offline (no fetch), so it's instant everywhere a link shows and it's tested
// (tests/proof-source.test.ts). Unknown sites fall back to their own name.

export type ProofSource = {
  /** The tool, as people say it: "Figma", "Google Drive", "Onshape". */
  tool: string;
  /** What the link is, in a few words: "Figma design", "Pull request #42". */
  label: string;
  /** The kind of proof, for grouping and icons. */
  kind: "code" | "design" | "cad" | "doc" | "data" | "video" | "image" | "site" | "paper" | "task" | "link";
};

type Rule = { host: RegExp; tool: string; kind: ProofSource["kind"]; label: (u: URL) => string };

const path = (u: URL) => u.pathname;
const num = (re: RegExp, u: URL) => re.exec(path(u))?.[1];

// Most specific first. Hosts are matched without "www.".
const RULES: Rule[] = [
  // Code
  { host: /^github\.com$/, tool: "GitHub", kind: "code", label: (u) => {
    const pr = num(/\/pull\/(\d+)/, u); if (pr) return `Pull request #${pr}`;
    const c = num(/\/commits?\/([0-9a-f]{7})/i, u); if (c) return `Commit ${c}`;
    const is = num(/\/issues\/(\d+)/, u); if (is) return `Issue #${is}`;
    if (/\/releases\//.test(path(u))) return "Release";
    const repo = /^\/([^/]+\/[^/]+)/.exec(path(u))?.[1]; return repo ? `Repository ${repo}` : "GitHub";
  } },
  { host: /^gitlab\.com$/, tool: "GitLab", kind: "code", label: (u) => { const mr = num(/\/merge_requests\/(\d+)/, u); return mr ? `Merge request !${mr}` : "GitLab project"; } },
  { host: /^bitbucket\.org$/, tool: "Bitbucket", kind: "code", label: (u) => { const pr = num(/\/pull-requests\/(\d+)/, u); return pr ? `Pull request #${pr}` : "Bitbucket repository"; } },
  { host: /^(replit\.com|codepen\.io|codesandbox\.io|stackblitz\.com)$/, tool: "Live code", kind: "code", label: () => "Live code" },
  { host: /^colab\.research\.google\.com$/, tool: "Google Colab", kind: "data", label: () => "Colab notebook" },
  { host: /^(kaggle\.com)$/, tool: "Kaggle", kind: "data", label: (u) => (/\/code\//.test(path(u)) ? "Kaggle notebook" : /\/competitions\//.test(path(u)) ? "Kaggle competition" : "Kaggle") },
  { host: /^huggingface\.co$/, tool: "Hugging Face", kind: "data", label: (u) => (/^\/spaces\//.test(path(u)) ? "Hugging Face demo" : /^\/datasets\//.test(path(u)) ? "Hugging Face dataset" : "Hugging Face model") },
  { host: /^wandb\.ai$/, tool: "Weights & Biases", kind: "data", label: () => "Training run" },
  // Design
  { host: /^figma\.com$/, tool: "Figma", kind: "design", label: (u) => (/^\/proto\//.test(path(u)) ? "Figma prototype" : /^\/board\//.test(path(u)) ? "FigJam board" : "Figma design") },
  { host: /^(behance\.net)$/, tool: "Behance", kind: "design", label: () => "Behance project" },
  { host: /^(dribbble\.com)$/, tool: "Dribbble", kind: "design", label: () => "Dribbble shot" },
  { host: /^canva\.com$/, tool: "Canva", kind: "design", label: () => "Canva design" },
  { host: /^miro\.com$/, tool: "Miro", kind: "design", label: () => "Miro board" },
  // CAD and hardware
  { host: /^cad\.onshape\.com$/, tool: "Onshape", kind: "cad", label: () => "Onshape CAD model" },
  { host: /^(a360\.co|.*\.autodesk360\.com|gallery\.autodesk\.com)$/, tool: "Fusion", kind: "cad", label: () => "Fusion CAD model" },
  { host: /^grabcad\.com$/, tool: "GrabCAD", kind: "cad", label: () => "GrabCAD model" },
  { host: /^(printables\.com|thingiverse\.com)$/, tool: "3D print", kind: "cad", label: () => "3D print model" },
  { host: /^(oshwlab\.com|easyeda\.com)$/, tool: "EasyEDA", kind: "cad", label: () => "Circuit design" },
  { host: /^(wokwi\.com|tinkercad\.com)$/, tool: "Simulator", kind: "cad", label: () => "Circuit simulation" },
  // Docs, files and tasks
  { host: /^docs\.google\.com$/, tool: "Google Docs", kind: "doc", label: (u) => (/^\/spreadsheets\//.test(path(u)) ? "Google Sheet" : /^\/presentation\//.test(path(u)) ? "Google Slides" : /^\/forms\//.test(path(u)) ? "Google Form" : "Google Doc") },
  { host: /^drive\.google\.com$/, tool: "Google Drive", kind: "doc", label: () => "Google Drive file" },
  { host: /^(dropbox\.com)$/, tool: "Dropbox", kind: "doc", label: () => "Dropbox file" },
  { host: /^(onedrive\.live\.com|1drv\.ms|.*\.sharepoint\.com)$/, tool: "OneDrive", kind: "doc", label: () => "OneDrive file" },
  { host: /^(notion\.so|.*\.notion\.site)$/, tool: "Notion", kind: "doc", label: () => "Notion page" },
  { host: /^overleaf\.com$/, tool: "Overleaf", kind: "paper", label: () => "Overleaf paper" },
  { host: /^arxiv\.org$/, tool: "arXiv", kind: "paper", label: (u) => { const id = num(/\/(?:abs|pdf)\/([\d.]+)/, u); return id ? `arXiv paper ${id}` : "arXiv paper"; } },
  { host: /^(doi\.org|scholar\.google\.com|researchgate\.net|biorxiv\.org|medrxiv\.org|osf\.io)$/, tool: "Paper", kind: "paper", label: () => "Published paper" },
  { host: /^linear\.app$/, tool: "Linear", kind: "task", label: (u) => { const id = /\/issue\/([A-Z]+-\d+)/.exec(path(u))?.[1]; return id ? `Linear issue ${id}` : "Linear issue"; } },
  { host: /^.*\.atlassian\.net$/, tool: "Jira", kind: "task", label: (u) => { const id = /\/browse\/([A-Z][A-Z0-9]+-\d+)/.exec(path(u))?.[1]; return id ? `Jira ticket ${id}` : /\/wiki\//.test(path(u)) ? "Confluence page" : "Jira ticket"; } },
  { host: /^(trello\.com|asana\.com|app\.asana\.com|clickup\.com|app\.clickup\.com)$/, tool: "Task board", kind: "task", label: () => "Task board" },
  // Video and images
  { host: /^(youtube\.com|youtu\.be|m\.youtube\.com)$/, tool: "YouTube", kind: "video", label: () => "YouTube video" },
  { host: /^(vimeo\.com)$/, tool: "Vimeo", kind: "video", label: () => "Vimeo video" },
  { host: /^(loom\.com)$/, tool: "Loom", kind: "video", label: () => "Loom recording" },
  // Shipped things
  { host: /^apps\.apple\.com$/, tool: "App Store", kind: "site", label: () => "App Store listing" },
  { host: /^play\.google\.com$/, tool: "Google Play", kind: "site", label: () => "Google Play listing" },
  { host: /^devpost\.com$/, tool: "Devpost", kind: "site", label: () => "Devpost project" },
  { host: /^(.*\.vercel\.app|.*\.netlify\.app|.*\.github\.io|.*\.pages\.dev)$/, tool: "Live site", kind: "site", label: () => "Live site" },
];

const IMAGE = /\.(png|jpe?g|gif|webp|avif|heic)$/i;
const VIDEO = /\.(mp4|mov|webm)$/i;
const DOC = /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md)$/i;
const CAD = /\.(stl|step|stp|obj|3mf|glb|gltf|f3d|sldprt|dxf)$/i;

/** What a proof link is and which tool it's from. null for something that isn't a web link. */
export function proofSource(raw: string): ProofSource | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const r of RULES) if (r.host.test(host)) return { tool: r.tool, kind: r.kind, label: r.label(u) };
  // A file anywhere: say what kind.
  const p = u.pathname;
  if (IMAGE.test(p)) return { tool: host, kind: "image", label: "Photo" };
  if (VIDEO.test(p)) return { tool: host, kind: "video", label: "Video" };
  if (CAD.test(p)) return { tool: host, kind: "cad", label: "3D model" };
  if (DOC.test(p)) return { tool: host, kind: "doc", label: `${p.split(".").pop()!.toUpperCase()} file` };
  return { tool: host, kind: "link", label: host };
}

/** The tools, by field, for hints where someone adds proof. */
export const PROOF_TOOLS_HINT = "A link from the tool you used: GitHub, Figma, Onshape, Google Drive, Notion, Jira, a paper, a video or a photo.";
