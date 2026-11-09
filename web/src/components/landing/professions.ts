import { Bot, BrainCircuit, ChartColumn, Cloud, Code, Cpu, PenTool, ShieldCheck, type LucideIcon } from "lucide-react";

// The tech professions the landing page shows. Each one carries an example profile (clearly
// labelled "Example" wherever it's shown) so visitors can see what their own Forge page would hold.
export type Profession = {
  id: string;
  title: string;
  short: string;
  icon: LucideIcon;
  /** Decorative gradient for the project thumbnail and icon tile. */
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
    id: "software", title: "Software Engineering", short: "Software", icon: Code, grad: "linear-gradient(135deg,#6366f1,#38bdf8)",
    blurb: "Ship apps people actually use, and show the commits, users and demo days behind them.",
    clubs: ["ACM chapters", "Hackathon clubs", "Open-source groups"],
    post: "Shipped v2 of our dining tracker: p95 latency down 38%.",
    lookingFor: "Startups and new-grad engineering teams",
    person: { first: "Maya", last: "Chen", headline: "CS '27 · ACM Chapter" },
    project: { title: "Campus Eats: real-time dining tracker", metric: "4,200", metricLabel: "weekly users", verified: "Demoed at ACM Demo Day" },
    skills: ["TypeScript", "Next.js", "Postgres"], following: 6,
  },
  {
    id: "ai", title: "AI & Machine Learning", short: "AI / ML", icon: BrainCircuit, grad: "linear-gradient(135deg,#8b5cf6,#ec4899)",
    blurb: "Models, evals and the write-up that proves you know why it works, not just that it runs.",
    clubs: ["AI societies", "ML reading groups", "Research labs"],
    post: "Our on-device sign-language model hit 94% on the held-out set.",
    lookingFor: "Applied ML teams and research labs",
    person: { first: "Arjun", last: "Patel", headline: "Data Sci '26 · AI Society" },
    project: { title: "On-device sign-language translator", metric: "94.2%", metricLabel: "accuracy", verified: "Presented at AI Society Expo" },
    skills: ["PyTorch", "Computer vision", "ONNX"], following: 9,
  },
  {
    id: "data", title: "Data Science", short: "Data", icon: ChartColumn, grad: "linear-gradient(135deg,#06b6d4,#10b981)",
    blurb: "Turn messy public data into answers, and let people explore the notebook behind them.",
    clubs: ["Data science clubs", "Datathon teams", "Analytics societies"],
    post: "Built a bus-delay predictor from two years of city transit data.",
    lookingFor: "Analytics, fintech and civic-tech teams",
    person: { first: "Sofia", last: "Ramirez", headline: "Statistics '27 · Data Science Club" },
    project: { title: "City transit delay predictor", metric: "0.81", metricLabel: "R² on 2025 data", verified: "Won the club datathon" },
    skills: ["Python", "SQL", "dbt"], following: 4,
  },
  {
    id: "security", title: "Cybersecurity", short: "Security", icon: ShieldCheck, grad: "linear-gradient(135deg,#10b981,#84cc16)",
    blurb: "CTF finishes, write-ups and home labs: the proof security hiring managers actually ask for.",
    clubs: ["Cyber defense teams", "CTF clubs", "Ethical hacking groups"],
    post: "2nd of 140 teams at the regional CTF. Write-ups for all 12 flags inside.",
    lookingFor: "Security teams, red teams and SOCs",
    person: { first: "Jordan", last: "Lee", headline: "CompE '26 · Cyber Defense Team" },
    project: { title: "Regional CTF: 2nd of 140 teams", metric: "12", metricLabel: "flags captured", verified: "Team result verified by club" },
    skills: ["Linux", "Wireshark", "Rust"], following: 7,
  },
  {
    id: "robotics", title: "Robotics", short: "Robotics", icon: Bot, grad: "linear-gradient(135deg,#f59e0b,#ef4444)",
    blurb: "Competition runs, test videos and the code that made the robot do it.",
    clubs: ["Robotics teams", "Rover and drone clubs", "Formula SAE"],
    post: "Rover finished the autonomous course with 0.3 m average path error.",
    lookingFor: "Autonomy, hardware and defense-tech teams",
    person: { first: "Priya", last: "Nair", headline: "MechE '27 · Robotics Team" },
    project: { title: "Autonomous rover navigation stack", metric: "0.3 m", metricLabel: "path error", verified: "Competition run verified" },
    skills: ["ROS 2", "C++", "SLAM"], following: 11,
  },
  {
    id: "design", title: "Product Design", short: "Design", icon: PenTool, grad: "linear-gradient(135deg,#ec4899,#f97316)",
    blurb: "Case studies with the research, the rejected ideas and the numbers after launch.",
    clubs: ["Design clubs", "HCI groups", "Product teams"],
    post: "Usability study with 30 students: booking time down 42%.",
    lookingFor: "Product design and UX research teams",
    person: { first: "Lena", last: "Okafor", headline: "HCI '26 · Design Club" },
    project: { title: "Campus health app redesign", metric: "−42%", metricLabel: "task time", verified: "Study run with the Design Club" },
    skills: ["Figma", "User research", "Prototyping"], following: 5,
  },
  {
    id: "cloud", title: "Cloud & DevOps", short: "Cloud", icon: Cloud, grad: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    blurb: "The infrastructure behind your club's projects, with uptime to show for it.",
    clubs: ["Cloud clubs", "SRE study groups", "Club infra teams"],
    post: "Moved every club app onto one self-healing cluster. 99.95% uptime this term.",
    lookingFor: "Platform, SRE and infrastructure teams",
    person: { first: "Marcus", last: "Wright", headline: "IT '26 · Cloud Club" },
    project: { title: "Self-healing cluster for club apps", metric: "99.95%", metricLabel: "uptime", verified: "Runs the club's infrastructure" },
    skills: ["Kubernetes", "Terraform", "AWS"], following: 3,
  },
  {
    id: "hardware", title: "Hardware & EE", short: "Hardware", icon: Cpu, grad: "linear-gradient(135deg,#eab308,#22c55e)",
    blurb: "Schematics, board bring-up and the scope captures that prove it works.",
    clubs: ["IEEE branches", "Embedded systems clubs", "Maker spaces"],
    post: "First board revision is up: LoRa sensor node at 18 months on one battery.",
    lookingFor: "Embedded, semiconductor and IoT teams",
    person: { first: "Hana", last: "Kim", headline: "EE '27 · IEEE Branch" },
    project: { title: "Low-power LoRa sensor board", metric: "18 mo", metricLabel: "battery life", verified: "Bring-up at IEEE lab night" },
    skills: ["KiCad", "Embedded C", "PCB design"], following: 8,
  },
];
