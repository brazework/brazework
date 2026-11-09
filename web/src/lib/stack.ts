import { Beaker, CircuitBoard, Code2, Cog, LineChart, Wrench } from "lucide-react";

// The "Built with" catalog: tools across every STEM major, grouped the way builders think about them,
// each with one line on what it's for. Projects can also name tools outside the catalog (they show
// under "Other"). Used by the project editor, project pages, Explore, Ember and GitHub import.

export const STACK_CATEGORIES = [
  { id: "software", label: "Software", icon: Code2 },
  { id: "hardware", label: "Hardware & electronics", icon: CircuitBoard },
  { id: "cad", label: "CAD & mechanical", icon: Cog },
  { id: "lab", label: "Lab & bench", icon: Beaker },
  { id: "data", label: "Data & simulation", icon: LineChart },
  { id: "fab", label: "Fabrication", icon: Wrench },
] as const;
export type StackCategory = (typeof STACK_CATEGORIES)[number]["id"] | "other";

export const TOOLS: { name: string; cat: StackCategory; what: string }[] = [
  // Software
  { name: "Python", cat: "software", what: "General-purpose language for scripts, data and robotics." },
  { name: "C++", cat: "software", what: "Fast compiled language for robotics, games and embedded code." },
  { name: "C", cat: "software", what: "Low-level language for firmware and microcontrollers." },
  { name: "Rust", cat: "software", what: "Memory-safe systems language." },
  { name: "TypeScript", cat: "software", what: "Typed JavaScript for web apps." },
  { name: "Java", cat: "software", what: "Language for Android, backends and FRC robots." },
  { name: "Swift", cat: "software", what: "Apple's language for iOS and Mac apps." },
  { name: "React", cat: "software", what: "Library for building web interfaces." },
  { name: "ROS 2", cat: "software", what: "Robot Operating System: messaging and tools for robots." },
  { name: "Linux", cat: "software", what: "The operating system most robots and servers run." },
  { name: "Docker", cat: "software", what: "Packages software so it runs the same anywhere." },
  { name: "Git", cat: "software", what: "Version control for code and designs." },
  { name: "PyTorch", cat: "software", what: "Framework for training neural networks." },
  { name: "TensorFlow", cat: "software", what: "Framework for machine learning models." },
  { name: "OpenCV", cat: "software", what: "Computer vision: cameras, images, detection." },
  { name: "Unity", cat: "software", what: "Game engine, also used for simulation and AR/VR." },
  // Hardware & electronics
  { name: "Arduino", cat: "hardware", what: "Beginner-friendly microcontroller boards." },
  { name: "ESP32", cat: "hardware", what: "Microcontroller with Wi-Fi and Bluetooth." },
  { name: "STM32", cat: "hardware", what: "Industrial-grade microcontrollers for embedded systems." },
  { name: "Raspberry Pi", cat: "hardware", what: "Small Linux computer for robots and projects." },
  { name: "NVIDIA Jetson", cat: "hardware", what: "Small computer for on-board AI and vision." },
  { name: "KiCad", cat: "hardware", what: "Free tool for schematics and circuit boards." },
  { name: "Altium", cat: "hardware", what: "Professional PCB design software." },
  { name: "FPGA", cat: "hardware", what: "Reconfigurable chips for custom digital logic." },
  { name: "Verilog", cat: "hardware", what: "Language for describing digital circuits." },
  { name: "Oscilloscope", cat: "hardware", what: "Instrument that shows electrical signals over time." },
  { name: "Lidar", cat: "hardware", what: "Laser sensor that maps distances around a robot." },
  { name: "IMU", cat: "hardware", what: "Sensor for acceleration and rotation." },
  { name: "Load cell", cat: "hardware", what: "Sensor that measures force, e.g. engine thrust." },
  // CAD & mechanical
  { name: "SolidWorks", cat: "cad", what: "Industry CAD for parts and assemblies." },
  { name: "Fusion 360", cat: "cad", what: "CAD and CAM in one, popular with clubs." },
  { name: "Onshape", cat: "cad", what: "Browser-based CAD built for teams." },
  { name: "CATIA", cat: "cad", what: "Aerospace and automotive CAD." },
  { name: "Siemens NX", cat: "cad", what: "High-end CAD/CAM for complex parts." },
  { name: "AutoCAD", cat: "cad", what: "2D drafting and drawings." },
  { name: "GD&T", cat: "cad", what: "The language of tolerances on engineering drawings." },
  // Lab & bench
  { name: "PCR", cat: "lab", what: "Copies DNA so it can be measured or used." },
  { name: "CRISPR", cat: "lab", what: "Precise gene editing." },
  { name: "Gel electrophoresis", cat: "lab", what: "Separates DNA or proteins by size." },
  { name: "Cell culture", cat: "lab", what: "Growing cells under controlled conditions." },
  { name: "Microscopy", cat: "lab", what: "Imaging samples at small scales." },
  { name: "Spectroscopy", cat: "lab", what: "Identifies substances by how they absorb or emit light." },
  { name: "HPLC", cat: "lab", what: "Separates and measures chemicals in a mixture." },
  { name: "Wind tunnel", cat: "lab", what: "Tests airflow and forces on models." },
  { name: "Test stand", cat: "lab", what: "Rig for firing engines or loading parts safely." },
  // Data & simulation
  { name: "MATLAB", cat: "data", what: "Numerical computing, controls and signal processing." },
  { name: "Simulink", cat: "data", what: "Block diagrams for simulating control systems." },
  { name: "ANSYS", cat: "data", what: "Simulation of stress, heat and fluids (FEA/CFD)." },
  { name: "COMSOL", cat: "data", what: "Multiphysics simulation." },
  { name: "OpenFOAM", cat: "data", what: "Open-source fluid dynamics (CFD)." },
  { name: "OpenRocket", cat: "data", what: "Simulates model and high-power rocket flights." },
  { name: "LabVIEW", cat: "data", what: "Data acquisition and instrument control." },
  { name: "R", cat: "data", what: "Statistics and data analysis." },
  { name: "Jupyter", cat: "data", what: "Notebooks for analysis you can rerun and share." },
  { name: "Excel", cat: "data", what: "Spreadsheets for quick analysis and logs." },
  // Fabrication
  { name: "3D printing", cat: "fab", what: "Builds parts layer by layer from a CAD model." },
  { name: "CNC mill", cat: "fab", what: "Cuts precise metal or plastic parts from a block." },
  { name: "Lathe", cat: "fab", what: "Turns round parts like shafts and nozzles." },
  { name: "Laser cutter", cat: "fab", what: "Cuts sheets of wood, acrylic or metal." },
  { name: "Composite layup", cat: "fab", what: "Building strong, light parts from carbon or glass fiber." },
  { name: "Welding", cat: "fab", what: "Joining metal parts, e.g. frames and chassis." },
  { name: "Soldering", cat: "fab", what: "Joining electronic parts on a board." },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name.toLowerCase(), t]));
export const toolInfo = (name: string) => BY_NAME.get(name.toLowerCase()) ?? { name, cat: "other" as const, what: "" };

// A stack grouped by category, in catalog order, with tools outside the catalog last.
export function groupStack(tools: string[]) {
  const groups = new Map<StackCategory, { name: string; what: string }[]>();
  for (const t of tools) {
    const info = toolInfo(t);
    groups.set(info.cat, [...(groups.get(info.cat) ?? []), { name: info.name, what: info.what }]);
  }
  return [...STACK_CATEGORIES.map((c) => c.id), "other" as const].filter((c) => groups.has(c)).map((c) => ({ cat: c, tools: groups.get(c)! }));
}

// GitHub languages and topics to catalog tools (for "Import from GitHub").
const GH: Record<string, string> = { python: "Python", "c++": "C++", c: "C", rust: "Rust", typescript: "TypeScript", javascript: "TypeScript", java: "Java", swift: "Swift", matlab: "MATLAB", r: "R", "jupyter notebook": "Jupyter", verilog: "Verilog", systemverilog: "Verilog", vhdl: "FPGA", ros: "ROS 2", ros2: "ROS 2", react: "React", docker: "Docker", pytorch: "PyTorch", tensorflow: "TensorFlow", opencv: "OpenCV", arduino: "Arduino", esp32: "ESP32", stm32: "STM32", kicad: "KiCad", "raspberry-pi": "Raspberry Pi", unity: "Unity", openfoam: "OpenFOAM", lidar: "Lidar" };
export function toolsFromGitHub(words: string[]) {
  const out: string[] = [];
  for (const w of words) { const t = GH[w.toLowerCase()]; if (t && !out.includes(t)) out.push(t); if (out.length === 12) break; }
  return out;
}

// Tools named in free text (for Ember's "Organize" pass and quick suggestions).
export function toolsInText(text: string) {
  const lower = ` ${text.toLowerCase()} `;
  return TOOLS.filter((t) => new RegExp(`[^a-z0-9]${t.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(lower)).map((t) => t.name).slice(0, 12);
}
