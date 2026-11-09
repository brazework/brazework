import { Atom, BrainCircuit, Code, Cog, Dna, FlaskConical, HeartPulse, Landmark, Rocket, Sigma, TestTube, Zap, type LucideIcon } from "lucide-react";

// The STEM fields the landing page shows: engineering, the sciences, math and computing.
// Each has a schematic (see schematics.tsx, keyed by id) and an example profile, clearly
// labelled "Example" wherever it's shown, so visitors can see what their Forge page would hold.
export type Profession = {
  id: string;
  title: string;
  short: string;
  /** The people, for the hero headline: "Where {who} get found." */
  who: string;
  icon: LucideIcon;
  /** Decorative gradient for the profile banner and avatar. */
  grad: string;
  blurb: string;
  clubs: string[];
  post: string;
  lookingFor: string;
  person: { first: string; last: string; headline: string };
  project: { title: string; metric: string; metricLabel: string; verified: string };
  skills: string[];
  following: number;
};

export const PROFESSIONS: Profession[] = [
  {
    id: "mechanical", title: "Mechanical Engineering", short: "Mechanical", who: "mechanical engineers", icon: Cog, grad: "linear-gradient(135deg,#f59e0b,#ef4444)",
    blurb: "CAD, FEA and the parts you machined, with the load tests that prove they hold.",
    clubs: ["Formula SAE", "Baja SAE", "Robotics teams"],
    post: "New uprights passed load testing at 3.2 g with 31% less weight.",
    lookingFor: "Automotive, manufacturing and robotics teams",
    person: { first: "Diego", last: "Alvarez", headline: "MechE '27 · Formula SAE" },
    project: { title: "Carbon-fiber suspension upright", metric: "−31%", metricLabel: "weight vs. steel", verified: "Passed FSAE tech inspection" },
    skills: ["SolidWorks", "FEA", "CNC"], following: 9,
  },
  {
    id: "electrical", title: "Electrical Engineering", short: "Electrical", who: "electrical engineers", icon: Zap, grad: "linear-gradient(135deg,#eab308,#22c55e)",
    blurb: "Schematics, board bring-up and the scope captures that show it works.",
    clubs: ["IEEE branches", "Solar car teams", "Maker spaces"],
    post: "First board revision is up: a LoRa sensor node at 18 months on one battery.",
    lookingFor: "Power, semiconductor and embedded teams",
    person: { first: "Hana", last: "Kim", headline: "EE '27 · IEEE Branch" },
    project: { title: "Low-power LoRa sensor board", metric: "18 mo", metricLabel: "battery life", verified: "Bring-up at IEEE lab night" },
    skills: ["KiCad", "Embedded C", "PCB design"], following: 8,
  },
  {
    id: "civil", title: "Civil Engineering", short: "Civil", who: "civil engineers", icon: Landmark, grad: "linear-gradient(135deg,#64748b,#0ea5e9)",
    blurb: "Bridges, canoes and site plans, with the calcs and the load test on record.",
    clubs: ["ASCE chapters", "Concrete canoe", "Engineers Without Borders"],
    post: "Our 6 m steel bridge held 2,500 lb with 4 mm of deflection.",
    lookingFor: "Structural, transportation and infrastructure firms",
    person: { first: "Amara", last: "Okeke", headline: "CivE '26 · ASCE Chapter" },
    project: { title: "Steel bridge competition entry", metric: "2nd", metricLabel: "of 38 schools", verified: "Load test witnessed by judges" },
    skills: ["SAP2000", "AutoCAD", "Revit"], following: 6,
  },
  {
    id: "aerospace", title: "Aerospace Engineering", short: "Aerospace", who: "aerospace engineers", icon: Rocket, grad: "linear-gradient(135deg,#6366f1,#0ea5e9)",
    blurb: "Rockets, drones and airfoils: the sims, the flight data and the launch video.",
    clubs: ["Rocketry clubs", "Design/Build/Fly", "CubeSat teams"],
    post: "Stage separation worked first try. Apogee: 10,028 ft.",
    lookingFor: "Launch, aviation and space companies",
    person: { first: "Sam", last: "Rivera", headline: "AeroE '27 · Rocketry Club" },
    project: { title: "Two-stage high-power rocket", metric: "10,028 ft", metricLabel: "apogee", verified: "Flight logged at Spaceport America Cup" },
    skills: ["OpenRocket", "ANSYS Fluent", "MATLAB"], following: 11,
  },
  {
    id: "chemical", title: "Chemical Engineering", short: "Chemical", who: "chemical engineers", icon: FlaskConical, grad: "linear-gradient(135deg,#14b8a6,#6366f1)",
    blurb: "Processes, reactors and Chem-E-Cars, with the data from every run.",
    clubs: ["AIChE chapters", "Chem-E-Car teams", "Energy clubs"],
    post: "Our Chem-E-Car stopped 0.4 m from the line on a reaction timer.",
    lookingFor: "Energy, pharma and materials companies",
    person: { first: "Mei", last: "Lin", headline: "ChemE '26 · AIChE Chapter" },
    project: { title: "Chem-E-Car on a zinc-air cell", metric: "0.4 m", metricLabel: "stopping error", verified: "Ran at AIChE regionals" },
    skills: ["Aspen Plus", "Process control", "Lab safety"], following: 5,
  },
  {
    id: "biomedical", title: "Biomedical Engineering", short: "Biomedical", who: "biomedical engineers", icon: HeartPulse, grad: "linear-gradient(135deg,#ec4899,#ef4444)",
    blurb: "Devices, prosthetics and signals, built and tested with real users.",
    clubs: ["BMES chapters", "Prosthetics clubs", "Global health design"],
    post: "Our EMG hand now does 5 grips for $85 in parts.",
    lookingFor: "Medical device and health-tech teams",
    person: { first: "Jordan", last: "Lee", headline: "BME '27 · BMES Chapter" },
    project: { title: "Low-cost EMG prosthetic hand", metric: "$85", metricLabel: "parts cost", verified: "Demoed at BMES design day" },
    skills: ["Arduino", "Signal processing", "3D printing"], following: 7,
  },
  {
    id: "cs", title: "Computer Science", short: "CS", who: "computer scientists", icon: Code, grad: "linear-gradient(135deg,#6366f1,#38bdf8)",
    blurb: "Apps people actually use, with the commits, users and demo days behind them.",
    clubs: ["ACM chapters", "Hackathon clubs", "Open-source groups"],
    post: "Shipped v2 of our dining tracker: p95 latency down 38%.",
    lookingFor: "Startups and new-grad engineering teams",
    person: { first: "Maya", last: "Chen", headline: "CS '27 · ACM Chapter" },
    project: { title: "Campus Eats: real-time dining tracker", metric: "4,200", metricLabel: "weekly users", verified: "Demoed at ACM Demo Day" },
    skills: ["TypeScript", "Next.js", "Postgres"], following: 6,
  },
  {
    id: "ai", title: "Data Science & AI", short: "Data & AI", who: "data scientists", icon: BrainCircuit, grad: "linear-gradient(135deg,#8b5cf6,#ec4899)",
    blurb: "Models, evals and the write-up that proves you know why it works.",
    clubs: ["AI societies", "Datathon teams", "ML reading groups"],
    post: "Our on-device sign-language model hit 94% on the held-out set.",
    lookingFor: "Applied ML, analytics and research teams",
    person: { first: "Arjun", last: "Patel", headline: "Data Sci '26 · AI Society" },
    project: { title: "On-device sign-language translator", metric: "94.2%", metricLabel: "accuracy", verified: "Presented at AI Society Expo" },
    skills: ["PyTorch", "Computer vision", "SQL"], following: 9,
  },
  {
    id: "physics", title: "Physics", short: "Physics", who: "physicists", icon: Atom, grad: "linear-gradient(135deg,#0ea5e9,#8b5cf6)",
    blurb: "Experiments, instruments and analysis, from the tabletop to the telescope.",
    clubs: ["SPS chapters", "Astronomy clubs", "Research labs"],
    post: "Our cloud chamber counts muons at 1.1 per minute, right in line with theory.",
    lookingFor: "Research labs, national labs and quant teams",
    person: { first: "Elena", last: "Petrova", headline: "Physics '26 · SPS Chapter" },
    project: { title: "Tabletop cloud-chamber muon counter", metric: "1.1/min", metricLabel: "muon rate", verified: "Built with the Society of Physics Students" },
    skills: ["Python", "Data analysis", "Optics"], following: 4,
  },
  {
    id: "chemistry", title: "Chemistry", short: "Chemistry", who: "chemists", icon: TestTube, grad: "linear-gradient(135deg,#10b981,#06b6d4)",
    blurb: "Syntheses, spectra and lab notebooks that show your hands-on skill.",
    clubs: ["ACS student chapters", "Green chemistry clubs", "Research groups"],
    post: "Swapped in a recyclable catalyst: 92% yield and half the waste.",
    lookingFor: "Pharma, materials and research labs",
    person: { first: "Kwame", last: "Mensah", headline: "Chemistry '27 · ACS Chapter" },
    project: { title: "A greener synthesis of aspirin", metric: "92%", metricLabel: "yield", verified: "Presented at the ACS undergrad symposium" },
    skills: ["NMR", "HPLC", "Organic synthesis"], following: 5,
  },
  {
    id: "biology", title: "Biology", short: "Biology", who: "biologists", icon: Dna, grad: "linear-gradient(135deg,#22c55e,#14b8a6)",
    blurb: "Wet-lab work, field studies and synthetic biology, with the results to back it.",
    clubs: ["iGEM teams", "Pre-med societies", "Ecology clubs"],
    post: "Our biosensor turns green at 5 ppb of lead in tap water.",
    lookingFor: "Biotech, pharma and research labs",
    person: { first: "Sofia", last: "Ramirez", headline: "Biology '27 · iGEM Team" },
    project: { title: "Engineered bacteria that detect lead", metric: "5 ppb", metricLabel: "detection limit", verified: "Judged at the iGEM Jamboree" },
    skills: ["CRISPR", "PCR", "Microscopy"], following: 6,
  },
  {
    id: "math", title: "Mathematics", short: "Math", who: "mathematicians", icon: Sigma, grad: "linear-gradient(135deg,#f43f5e,#a855f7)",
    blurb: "Proofs, models and competition results, in a form people can follow.",
    clubs: ["Math clubs", "Putnam teams", "Actuarial societies"],
    post: "Proved our scheduling heuristic stays within 2% of optimal.",
    lookingFor: "Quant, actuarial and research teams",
    person: { first: "Noah", last: "Park", headline: "Math '26 · Math Club" },
    project: { title: "Near-optimal course scheduling", metric: "≤ 2%", metricLabel: "from optimal", verified: "Proof reviewed at Math Club seminar" },
    skills: ["Proofs", "Optimization", "Julia"], following: 5,
  },
];
