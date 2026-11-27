import type { BuildId } from "./cad/models";

// The example projects the landing hero follows from log to LinkedIn (components/landing/hero.tsx).
// The robot arm leads (a class project its professor verifies); the Formula SAE car is a
// senior-design capstone; software
// projects are drawn as the systems they run, with their own names for the three views.
// Every name, class, number and person here is an example, and the page says so. Each build is a
// real kind of student project, under a class (verified by its professor) or a club (by an officer).

export type Example = {
  id: BuildId;
  chip: string;
  kind: "class" | "club";
  // The class with its semester, or the club.
  where: string;
  name: string;
  milestone: string;
  proof: string;
  model: string;
  signer: string;
  role: string;
  callouts: Record<string, string>;
  team: { name: string; part: string }[];
  // What a recruiter would type to find this kind of work.
  search: string;
  major: string;
  // The ABET student outcome this kind of work is evidence for.
  outcome: string;
  // The stress view's scale, where it isn't stress (a board shows heat).
  field?: [string, string];
  // What the three views are called, where it isn't Render / Section / Stress (software).
  modes?: [string, string, string];
  // Software: the code is the proof file the professor opens, linked from GitHub.
  repo?: string;
  // A class project is an assignment in the course (Brazework Courses).
  assignment?: string;
};

const MAYA = "Maya Chen";
export const STUDENT = MAYA;

export const EXAMPLES: Example[] = [
  {
    id: "arm", chip: "Robot arm", kind: "class", where: "ME 482 Robotics · Fall 2026", name: "Benchtop cobot arm",
    milestone: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds", proof: "cycle-test-500-runs.csv", model: "cobot-arm.step",
    signer: "Prof. Dana Ruiz", role: "ME 482, Fall 2026", callouts: { j2: "J2 · 38 N·m peak", elbow: "Harmonic drive · 100:1", grip: "±0.05 mm · 3 kg" },
    assignment: "Assignment 3: Cycle-time test",
    team: [{ name: MAYA, part: "Trajectory planning" }, { name: "Noah Feld", part: "Gripper, end effector" }, { name: "Tara Singh", part: "Cycle tests" }],
    search: "robotics, motion planning, verified", major: "Mechanical Engineering", outcome: "1 · Solving complex problems",
  },
  {
    id: "fsae", chip: "Formula SAE", kind: "class", where: "ME 490 Formula SAE Capstone · Fall 2026", name: "2027 car, tube-frame chassis",
    milestone: "Frame tested 12% stiffer than the target, and 0.4 kg under weight", proof: "torsion-rig-test.xlsx", model: "fsae-27-frame.step",
    signer: "Prof. Alvarez", role: "ME 490, Fall 2026", callouts: { hoop: "Main hoop · Ø25.4 × 2.4 mm", sis: "Side impact · 3 tubes", push: "Pushrod · 2.1 kN" },
    assignment: "Design review 2: Torsion test",
    team: [{ name: MAYA, part: "Frame FEA, torsion rig" }, { name: "Diego Silva", part: "Suspension pickups" }, { name: "Hana Kim", part: "Welding, jig" }],
    search: "chassis FEA, verified", major: "Mechanical Engineering", outcome: "5 · Teamwork",
  },
  {
    id: "rover", chip: "Rover autonomy", kind: "class", where: "CS 485 Mobile Robotics · Fall 2026", name: "A* planner and lidar mapping",
    milestone: "Planner reached 48 of 50 goals in the cluttered yard, with no collisions", proof: "yard-run-12.mcap", model: "rover-nav", repo: "github.com/mchen/rover-nav",
    signer: "Prof. Iyer", role: "CS 485, Fall 2026", callouts: { path: "A* path · replans at 10 Hz", lidar: "Lidar · 900 points a turn", cost: "Cost map · 5 cm cells" },
    assignment: "Lab 4: Planner in the yard",
    team: [{ name: MAYA, part: "Planner, cost map" }, { name: "Noah Feld", part: "Lidar driver, SLAM" }, { name: "Tara Singh", part: "Field tests" }],
    search: "path planning, ROS, verified", major: "Computer Science", outcome: "1 · Solving complex problems", modes: ["Render", "Inside", "Cost map"], field: ["Free", "Blocked"],
  },
  {
    id: "nn", chip: "Neural network", kind: "class", where: "CS 489 Machine Learning · Fall 2026", name: "Weld-defect classifier",
    milestone: "Spots cracked welds in 94% of 2,000 new photos, up from 81%", proof: "eval-heldout.ipynb", model: "weld-cnn", repo: "github.com/mchen/weld-cnn",
    signer: "Prof. Brooks", role: "CS 489, Fall 2026", callouts: { input: "Input · 128 × 128 weld photo", conv: "Conv · 3 × 3, 32 filters", output: "Output · crack 0.91" },
    assignment: "Milestone 2: Test on new photos",
    team: [{ name: MAYA, part: "Model, training runs" }, { name: "Omar Haddad", part: "Dataset, labeling" }, { name: "Jess Liu", part: "Evaluation" }],
    search: "computer vision, PyTorch, verified", major: "Computer Science", outcome: "6 · Experimentation and analysis", modes: ["Render", "Layers", "Activations"], field: ["0", "1"],
  },
  {
    id: "drone", chip: "Drone", kind: "club", where: "Aerial Robotics Club", name: "5-inch inspection quad",
    milestone: "Held position within 0.3 m in 15 km/h wind over 6 test flights", proof: "hover-flights.bbl", model: "quad-5in.step",
    signer: "A. Novak", role: "president, Aerial Robotics Club", callouts: { arm: "Arm root · 5 mm carbon", motor: "2207 · 1,750 kV", stack: "F7 flight controller" },
    team: [{ name: MAYA, part: "PID tuning, flight tests" }, { name: "Ravi Shah", part: "Frame, motor mounts" }, { name: "Elle Moore", part: "Video, telemetry" }],
    search: "flight controls, verified", major: "Aerospace Engineering", outcome: "6 · Experimentation and analysis",
  },
  {
    id: "bridge", chip: "Truss bridge", kind: "class", where: "CE 331 Structures Lab · Fall 2026", name: "Pratt truss, 1:10 scale",
    milestone: "Held 2,500 lb at the middle and bent 0.21 in, well under the 0.5 in limit", proof: "load-test-run3.csv", model: "pratt-truss.step",
    signer: "Prof. Okafor", role: "CE 331, Fall 2026", callouts: { top: "Top chord · compression", bottom: "Bottom chord · tension", load: "Midspan · 11.1 kN" },
    assignment: "Lab 6: Load test",
    team: [{ name: MAYA, part: "Member sizing, hand calcs" }, { name: "Leo Park", part: "Fabrication, welds" }, { name: "Ana Ruiz", part: "Load test, strain gauges" }],
    search: "structural load test, verified", major: "Civil Engineering", outcome: "1 · Solving complex problems",
  },
  {
    id: "pcb", chip: "Circuit board", kind: "class", where: "ECE 455 Embedded Systems · Fall 2026", name: "Soil-sensor node, rev B",
    milestone: "Second board runs 14 months on two AA batteries", proof: "power-profile-revB.csv", model: "sensor-node-revB.kicad_pcb",
    signer: "Prof. Lin", role: "ECE 455, Fall 2026", callouts: { mcu: "MCU · 64-pin QFP", buck: "Buck · 68 °C peak", usb: "USB-C · 90 Ω pair" },
    assignment: "Milestone 3: Second board working",
    team: [{ name: MAYA, part: "Schematic, layout" }, { name: "Omar Haddad", part: "Firmware, sleep modes" }, { name: "Jess Liu", part: "Bring-up, power tests" }],
    search: "PCB layout, low power, verified", major: "Electrical Engineering", outcome: "2 · Engineering design", field: ["25 °C", "68 °C"],
  },
  {
    id: "cluster", chip: "Backend cluster", kind: "club", where: "ACM Club", name: "Event check-in backend",
    milestone: "Answered 5,000 requests a second in under 0.12 s, and lost none when a server was killed", proof: "k6-load-test.html", model: "checkin-api", repo: "github.com/acm/checkin-api",
    signer: "R. Patel", role: "president, ACM Club", callouts: { lb: "Load balancer · round robin", p99: "p99 · 118 ms at 5k req/s", db: "Postgres · 1 replica" },
    team: [{ name: MAYA, part: "API, load tests" }, { name: "Leo Park", part: "Database, replica" }, { name: "Ana Ruiz", part: "Deploys, alerts" }],
    search: "backend, load testing, verified", major: "Computer Science", outcome: "5 · Teamwork", modes: ["Render", "Inside", "Load"], field: ["Idle", "Saturated"],
  },
  {
    id: "gearbox", chip: "Gearbox", kind: "class", where: "ME 410 Capstone · Fall 2026", name: "5:1 planetary reduction",
    milestone: "Ran 2 hours at 40 N·m with no slip, case under 50 °C", proof: "dyno-run-2h.mp4", model: "planetary-5to1.step",
    signer: "Prof. Sato", role: "ME 410, Fall 2026", callouts: { ratio: "Carrier · 5:1", tooth: "Module 1.0 · 20° PA", shaft: "40 N·m output" },
    assignment: "Milestone 2: Two-hour load test",
    team: [{ name: MAYA, part: "Gear design, dyno test" }, { name: "Sam Ortiz", part: "Housing, bearings" }, { name: "Priya Nair", part: "Test rig, data logging" }],
    search: "drivetrain test, verified", major: "Mechanical Engineering", outcome: "6 · Experimentation and analysis",
  },
  {
    id: "avionics", chip: "Rocket avionics", kind: "club", where: "Rocketry Club", name: "Dual-deploy flight computer",
    milestone: "First certification flight: 1,140 m up, both parachutes out on time", proof: "flight-log-0412.csv", model: "av-bay-98mm.step",
    signer: "J. Reyes", role: "safety officer, Rocketry Club", callouts: { imu: "IMU + baro · 200 Hz", pyro: "Drogue / main pyro", frame: "Ø98 mm carbon airframe" },
    team: [{ name: MAYA, part: "Flight computer, firmware" }, { name: "Ben Adler", part: "Airframe, recovery" }, { name: "Cara Diaz", part: "Ground station" }],
    search: "propulsion test, verified", major: "Aerospace Engineering", outcome: "6 · Experimentation and analysis",
  },
];

// The rubric a professor grades a class milestone against, each row tied to an ABET student outcome
// (Brazework Courses). Out of 10 each.
export const RUBRIC: { row: string; outcome: string; score: number }[] = [
  { row: "Design and method", outcome: "ABET 2", score: 9 },
  { row: "Testing and results", outcome: "ABET 6", score: 10 },
  { row: "Teamwork", outcome: "ABET 5", score: 8 },
];
export const course = (ex: Example) => ex.where.split(" ").slice(0, 2).join(" ");
