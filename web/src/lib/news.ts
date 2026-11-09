import { cacheLife } from "next/cache";
import { ALL_TOPICS, TOPICS } from "@/lib/forge";

// STEM news for the feed's right rail: headlines from well-known science and engineering
// publishers' public RSS feeds, matched to each member's interests (Forge's interests-first rule).
// We show only the headline, the source, the date and a link to the publisher; article text is
// never shown. All feeds are fetched together at most once an hour and shared by every member.

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  published: string; // ISO date
  topics: string[]; // Forge interests the headline itself names (strong match)
  related: string[]; // interests the publisher's summary mentions at least twice (weaker match)
  fields: string[]; // Forge fields (Engineering, Physics, ...)
};

export type NewsPick = NewsItem & { reason: string };

type Source = { name: string; url: string; fields?: string[] };

const SOURCES: Source[] = [
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/technology.xml" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml", fields: ["Data & AI"] },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/space_time.xml", fields: ["Space Science"] },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/matter_energy/engineering.xml", fields: ["Engineering"] },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/health_medicine.xml", fields: ["Health & Medicine"] },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/earth_climate.xml", fields: ["Earth & Environment"] },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/plants_animals.xml", fields: ["Biology & Life Sciences"] },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", fields: ["Engineering"] },
  { name: "MIT News", url: "https://news.mit.edu/rss/research" },
  { name: "NASA", url: "https://www.nasa.gov/news-release/feed/", fields: ["Space Science"] },
  { name: "Phys.org", url: "https://phys.org/rss-feed/" },
  { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/science" },
  { name: "Nature", url: "https://www.nature.com/nature.rss" },
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home/" },
  { name: "Science News", url: "https://www.sciencenews.org/feed" },
  { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", fields: ["Data & AI"] },
];

// Words that put a headline under each Forge interest. Matched as whole words, ignoring case.
const KEYWORDS: Record<string, string[]> = {
  "Mechanical Design": ["mechanical engineer\\w*", "gearbox", "actuators?", "cad", "machine design", "mechanism", "prototype"],
  "Electrical & Power Systems": ["power grid", "grid", "transformers?", "electric(al)? power", "circuits?", "semiconductors?", "chips?", "transistors?", "power electronics"],
  "Civil & Structural": ["bridges?", "civil engineer\\w*", "concrete", "skyscrapers?", "infrastructure", "earthquake-resistant", "structural"],
  "Aerospace": ["aerospace", "aircraft", "airplanes?", "jet engines?", "fighter jets?", "rockets?", "spacecraft", "aviation", "hypersonic", "satellites?", "drones?", "airlines?", "wings?"],
  "Embedded Systems": ["embedded", "microcontrollers?", "firmware", "iot", "internet of things", "sensors?", "fpga"],
  "Manufacturing & 3D Printing": ["3d[- ]print\\w*", "additive manufacturing", "manufactur\\w*", "factory", "factories"],
  "Biomedical Devices": ["medical devices?", "implants?", "prosthe\\w*", "wearables?", "pacemakers?", "brain[- ]computer interface", "biosensors?"],
  "Materials Engineering": ["materials?", "alloys?", "metamaterials?", "graphene", "ceramics?", "composites?"],
  "Software Engineering": ["software", "programming", "developers?", "open[- ]source", "github", "coding"],
  "Cybersecurity": ["cyber\\w*", "hack(s|ers?|ed|ing)?", "malware", "ransomware", "encryption", "vulnerabilit\\w*", "security breach", "phishing", "passwords?"],
  "Distributed Systems": ["cloud", "data ?cent(er|re)s?", "distributed", "servers?", "networking", "blockchain"],
  "Programming Languages": ["programming languages?", "compilers?", "python", "rust", "javascript", "java"],
  "Human-Computer Interaction": ["user interface", "virtual reality", "augmented reality", "\\bvr\\b", "\\bar\\b", "haptic\\w*", "human-computer", "accessibility"],
  "Theory of Computation": ["algorithms?", "complexity", "computational theory", "turing", "p versus np", "computer science"],
  "Machine Learning": ["machine learning", "deep learning", "neural networks?", "artificial intelligence", "\\bai\\b", "ai models?", "training data"],
  "Large Language Models": ["large language models?", "\\bllms?\\b", "chatbots?", "chatgpt", "gpt-?\\d*", "claude", "gemini", "generative ai", "language models?"],
  "Computer Vision": ["computer vision", "image recognition", "facial recognition", "object detection", "cameras?", "lidar"],
  "Robotics & Autonomy": ["robots?", "robotic\\w*", "autonomous", "self-driving", "humanoids?", "drones?"],
  "Data Engineering": ["big data", "databases?", "data pipelines?", "data engineering", "analytics"],
  "AI Safety": ["ai safety", "alignment", "ai risk", "deepfakes?", "ai regulation", "responsible ai"],
  "Algebra": ["algebra\\w*", "equations?", "group theory"],
  "Topology": ["topolog\\w*", "knots?", "manifolds?"],
  "Number Theory": ["prime numbers?", "primes", "number theory", "riemann"],
  "Probability & Statistics": ["statistic\\w*", "probabilit\\w*"],
  "Optimization": ["optimi[sz]ation", "optimal", "operations research"],
  "Mathematical Logic": ["mathematical logic", "proofs?", "theorems?", "g[öo]del"],
  "Quantum Computing": ["quantum comput\\w*", "qubits?", "quantum processors?", "quantum computers?", "quantum"],
  "Condensed Matter": ["superconduct\\w*", "condensed matter", "crystals?", "magnets?", "magnetic", "semiconductors?"],
  "Particle Physics": ["particles?", "cern", "collider", "neutrinos?", "quarks?", "higgs", "dark matter"],
  "Optics & Photonics": ["optics?", "optical", "photon\\w*", "lasers?"],
  "Fluid Dynamics": ["fluid\\w*", "turbulen\\w*", "aerodynamic\\w*"],
  "Plasma Physics": ["plasma", "fusion", "tokamak", "stellarator"],
  "Organic Chemistry": ["organic chemistry", "molecules?", "molecular", "synthesis"],
  "Materials Chemistry": ["materials chemistry", "nanomaterials?", "nanoparticles?", "porous", "mofs?"],
  "Batteries & Electrochemistry": ["batter(y|ies)", "lithium", "electrochemi\\w*", "electrolytes?", "fuel cells?", "solid-state batter\\w*"],
  "Catalysis": ["cataly\\w*", "enzymes?"],
  "Polymers": ["polymers?", "plastics?", "microplastics?"],
  "Analytical Chemistry": ["spectroscop\\w*", "mass spectrometry", "chemical analysis"],
  "Genomics": ["genom\\w*", "genes?", "genetic\\w*", "dna", "crispr", "rna"],
  "Synthetic Biology": ["synthetic biology", "gene editing", "crispr", "engineered (cells|bacteria|microbes)"],
  "Neuroscience": ["brains?", "neuro\\w*", "neurons?", "memory", "cognitive", "alzheimer'?s?"],
  "Ecology": ["ecolog\\w*", "ecosystems?", "species", "biodiversity", "wildlife", "forests?"],
  "Microbiology": ["bacteri\\w*", "microb\\w*", "virus(es)?", "viral", "pathogens?", "fungi", "fungus"],
  "Bioinformatics": ["bioinformatics", "protein folding", "alphafold", "computational biology"],
  "Climate Science": ["climate", "global warming", "carbon", "emissions?", "greenhouse", "heatwaves?", "warming"],
  "Renewable Energy": ["solar", "wind (power|energy|turbines?)", "renewable\\w*", "clean energy", "hydrogen", "geothermal", "nuclear"],
  "Geology": ["geolog\\w*", "earthquakes?", "volcan\\w*", "rocks?", "minerals?", "tectonic"],
  "Oceanography": ["oceans?", "marine", "seas?", "coral", "reefs?", "sea level"],
  "Hydrology": ["water", "rivers?", "drought", "floods?", "groundwater", "rainfall"],
  "Sustainability": ["sustainab\\w*", "recycl\\w*", "circular economy", "waste", "pollution"],
  "Medical Imaging": ["mri", "imaging", "x-rays?", "ct scans?", "ultrasound"],
  "Epidemiology": ["epidemi\\w*", "outbreaks?", "pandemic", "infections?", "disease spread"],
  "Pharmacology": ["drugs?", "pharma\\w*", "medications?", "vaccines?", "antibiotics?", "therap(y|ies)"],
  "Public Health": ["public health", "mortality", "obesity", "nutrition", "life expectancy"],
  "Biomechanics": ["biomechanic\\w*", "muscles?", "bones?", "gait", "joints?", "exoskeletons?"],
  "Health Tech": ["health tech", "digital health", "telehealth", "health apps?", "wearables?", "medical ai"],
  "Astrophysics": ["astrophysic\\w*", "stars?", "galax(y|ies)", "black holes?", "supernova\\w*", "neutron stars?", "telescopes?"],
  "Planetary Science": ["planets?", "mars", "moons?", "jupiter", "saturn", "venus", "asteroids?", "comets?", "exoplanets?"],
  "Space Systems": ["spacecraft", "satellites?", "space station", "iss", "rocket launch\\w*", "rockets?", "orbit\\w*", "nasa", "spacex", "artemis", "moon base", "lunar"],
  "Cosmology": ["cosmolog\\w*", "big bang", "universe", "dark energy", "dark matter", "cosmic"],
};

const FIELD_OF: Record<string, string> = Object.fromEntries(TOPICS.flatMap((g) => g.topics.map((t) => [t, g.name])));
const MATCHERS: [string, RegExp][] = ALL_TOPICS.map((t) => [t, new RegExp(`\\b(${(KEYWORDS[t] ?? [t.toLowerCase()]).join("|")})\\b`, "gi")]);
const hits = (re: RegExp, s: string) => s.match(re)?.length ?? 0;
// Publisher categories that name a Forge field directly (e.g. Quanta's "Physics").
const CATEGORY_FIELDS: [RegExp, string][] = [
  [/\b(engineering|technology)\b/i, "Engineering"], [/\bcomputer science|computing\b/i, "Computer Science"],
  [/\b(ai|artificial intelligence|machine learning)\b/i, "Data & AI"], [/\bmath\w*/i, "Mathematics"], [/\bphysics\b/i, "Physics"],
  [/\bchemistry\b/i, "Chemistry"], [/\b(biology|life sciences?)\b/i, "Biology & Life Sciences"], [/\b(earth|environment|climate)\b/i, "Earth & Environment"],
  [/\b(health|medicine|medical)\b/i, "Health & Medicine"], [/\b(space|astronomy)\b/i, "Space Science"],
];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
function clean(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

// A small RSS/RDF reader: just the parts we need from each <item>.
function parse(xml: string, src: Source): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const title = clean(tag(it, "title"));
    const link = clean(tag(it, "link")) || clean(tag(it, "guid"));
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const when = Date.parse(clean(tag(it, "pubDate")) || clean(tag(it, "dc:date")) || clean(tag(it, "dc:source")).match(/\d{4}-\d{2}-\d{2}/)?.[0] || "");
    const summary = clean(tag(it, "description") || tag(it, "content:encoded")).slice(0, 600);
    const categories = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((c) => clean(c[1]));
    // Strong: the headline names the topic. Weaker: the summary mentions it at least twice
    // (one passing mention, like "launch" or "drone", isn't what a story is about).
    const topics = MATCHERS.filter(([, re]) => hits(re, title) > 0).map(([t]) => t);
    const related = MATCHERS.filter(([t, re]) => !topics.includes(t) && hits(re, summary) >= 2).map(([t]) => t);
    const fields = new Set([...(src.fields ?? []), ...topics.map((t) => FIELD_OF[t])]);
    for (const c of categories) for (const [re, f] of CATEGORY_FIELDS) if (re.test(c)) fields.add(f);
    out.push({ title, link, source: src.name, published: new Date(Number.isNaN(when) ? 0 : when).toISOString(), topics, related, fields: [...fields] });
  }
  return out;
}

async function readFeed(src: Source): Promise<NewsItem[]> {
  try {
    const res = await fetch(src.url, {
      headers: { "User-Agent": "ForgeNews/1.0 (+https://forge-app-eight-alpha.vercel.app)", Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parse(await res.text(), src);
  } catch {
    return []; // one slow or broken feed never takes the others down
  }
}

// Every feed, fetched together at most once an hour and shared by all members.
export async function newsPool(): Promise<NewsItem[]> {
  "use cache";
  cacheLife("hours");
  const all = (await Promise.all(SOURCES.map(readFeed))).flat();
  const cutoff = Date.now() - 14 * 864e5;
  const seen = new Set<string>();
  return all
    .filter((n) => Date.parse(n.published) > cutoff)
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .filter((n) => {
      const key = n.title.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(key) || seen.has(n.link)) return false;
      seen.add(key);
      seen.add(n.link);
      return true;
    })
    .slice(0, 400);
}

// Headlines for one member: stories on their interests first (more matching interests and newer
// rank higher), then stories in their field, then the latest STEM headlines if there aren't enough.
// No more than 2 in a row from one publisher, so one busy feed can't fill the list.
export function pickNews(pool: NewsItem[], interests: string[], field: string, n = 6, now = Date.now()): NewsPick[] {
  const mine = new Set(interests);
  const scored = pool.map((item) => {
    const strong = item.topics.filter((t) => mine.has(t));
    const weak = item.related.filter((t) => mine.has(t));
    const inField = !!field && item.fields.includes(field);
    const ageDays = Math.max(0, (now - Date.parse(item.published)) / 864e5);
    const score = strong.length * 10 + weak.length * 4 + (inField ? 2 : 0) - ageDays;
    const match = strong[0] ?? weak[0];
    const reason = match ? `Matches ${match}` : inField ? `In ${field}` : "Top STEM news";
    return { ...item, score, reason, tier: match ? 0 : inField ? 1 : 2 };
  });
  scored.sort((a, b) => a.tier - b.tier || b.score - a.score);
  const out: NewsPick[] = [];
  const perSource = new Map<string, number>();
  for (const s of scored) {
    if ((perSource.get(s.source) ?? 0) >= 2) continue;
    perSource.set(s.source, (perSource.get(s.source) ?? 0) + 1);
    const { score: _score, tier: _tier, ...pick } = s;
    void _score; void _tier;
    out.push(pick);
    if (out.length >= n) break;
  }
  return out;
}
