import type { BuildId } from "./cad/models";

// The example projects the landing hero follows from log to LinkedIn (components/landing/hero.tsx).
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
};

const MAYA = "Maya Chen";
export const STUDENT = MAYA;

export const EXAMPLES: Example[] = [
  {
    id: "gearbox", chip: "Gearbox", kind: "class", where: "ME 410 Capstone · Fall 2026", name: "5:1 planetary reduction",
    milestone: "Ran 2 hours at 40 N·m with no slip, case under 50 °C", proof: "dyno-run-2h.mp4", model: "planetary-5to1.step",
    signer: "Prof. Alvarez", role: "ME 410, Fall 2026", callouts: { ratio: "Carrier · 5:1", tooth: "Module 1.0 · 20° PA", shaft: "40 N·m output" },
    team: [{ name: MAYA, part: "Gear design, dyno test" }, { name: "Sam Ortiz", part: "Housing, bearings" }, { name: "Priya Nair", part: "Test rig, data logging" }],
    search: "drivetrain test, verified", major: "Mechanical Engineering", outcome: "SO 6 · Experimentation and analysis",
  },
  {
    id: "bridge", chip: "Truss bridge", kind: "class", where: "CE 331 Structures Lab · Fall 2026", name: "Pratt truss, 1:10 scale",
    milestone: "Carried 2,500 lb at midspan with 0.21 in deflection, under the 0.5 in limit", proof: "load-test-run3.csv", model: "pratt-truss.step",
    signer: "Prof. Okafor", role: "CE 331, Fall 2026", callouts: { top: "Top chord · compression", bottom: "Bottom chord · tension", load: "Midspan · 11.1 kN" },
    team: [{ name: MAYA, part: "Member sizing, hand calcs" }, { name: "Leo Park", part: "Fabrication, welds" }, { name: "Ana Ruiz", part: "Load test, strain gauges" }],
    search: "structural load test, verified", major: "Civil Engineering", outcome: "SO 1 · Solving complex problems",
  },
  {
    id: "pcb", chip: "Circuit board", kind: "class", where: "ECE 455 Embedded Systems · Fall 2026", name: "Soil-sensor node, rev B",
    milestone: "Rev B board up: 38 µA asleep, 14 months on two AA cells", proof: "power-profile-revB.csv", model: "sensor-node-revB.kicad_pcb",
    signer: "Prof. Lin", role: "ECE 455, Fall 2026", callouts: { mcu: "MCU · 64-pin QFP", buck: "Buck · 68 °C peak", usb: "USB-C · 90 Ω pair" },
    team: [{ name: MAYA, part: "Schematic, layout" }, { name: "Omar Haddad", part: "Firmware, sleep modes" }, { name: "Jess Liu", part: "Bring-up, power tests" }],
    search: "PCB layout, low power, verified", major: "Electrical Engineering", outcome: "SO 2 · Engineering design", field: ["25 °C", "68 °C"],
  },
  {
    id: "fsae", chip: "Formula SAE", kind: "club", where: "Formula SAE", name: "2027 car, tube-frame chassis",
    milestone: "Torsion test: 2,350 N·m per degree, 12% over target, 0.4 kg under weight", proof: "torsion-rig-test.xlsx", model: "fsae-27-frame.step",
    signer: "K. Osei", role: "chief engineer, Formula SAE", callouts: { hoop: "Main hoop · Ø25.4 × 2.4 mm", sis: "Side impact · 3 tubes", push: "Pushrod · 2.1 kN" },
    team: [{ name: MAYA, part: "Frame FEA, torsion rig" }, { name: "Diego Silva", part: "Suspension pickups" }, { name: "Hana Kim", part: "Welding, jig" }],
    search: "chassis FEA, verified", major: "Mechanical Engineering", outcome: "SO 5 · Teamwork",
  },
  {
    id: "drone", chip: "Drone", kind: "club", where: "Aerial Robotics Club", name: "5-inch inspection quad",
    milestone: "Held position within 0.3 m in 15 km/h wind over 6 test flights", proof: "hover-flights.bbl", model: "quad-5in.step",
    signer: "A. Novak", role: "president, Aerial Robotics Club", callouts: { arm: "Arm root · 5 mm carbon", motor: "2207 · 1,750 kV", stack: "F7 flight controller" },
    team: [{ name: MAYA, part: "PID tuning, flight tests" }, { name: "Ravi Shah", part: "Frame, motor mounts" }, { name: "Elle Moore", part: "Video, telemetry" }],
    search: "flight controls, verified", major: "Aerospace Engineering", outcome: "SO 6 · Experimentation and analysis",
  },
  {
    id: "arm", chip: "Robot arm", kind: "class", where: "ME 482 Robotics · Fall 2026", name: "Benchtop cobot arm",
    milestone: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds", proof: "cycle-test-500-runs.csv", model: "cobot-arm.step",
    signer: "Prof. Dana Ruiz", role: "ME 482, Fall 2026", callouts: { j2: "J2 · 38 N·m peak", elbow: "Harmonic drive · 100:1", grip: "±0.05 mm · 3 kg" },
    team: [{ name: MAYA, part: "Trajectory planning" }, { name: "Noah Feld", part: "Gripper, end effector" }, { name: "Tara Singh", part: "Cycle tests" }],
    search: "robotics, motion planning, verified", major: "Mechanical Engineering", outcome: "SO 1 · Solving complex problems",
  },
  {
    id: "avionics", chip: "Rocket avionics", kind: "club", where: "Rocketry Club", name: "Dual-deploy flight computer",
    milestone: "Level 1 flight: 1,140 m apogee, both charges fired on time", proof: "flight-log-0412.csv", model: "av-bay-98mm.step",
    signer: "J. Reyes", role: "safety officer, Rocketry Club", callouts: { imu: "IMU + baro · 200 Hz", pyro: "Drogue / main pyro", frame: "Ø98 mm carbon airframe" },
    team: [{ name: MAYA, part: "Flight computer, firmware" }, { name: "Ben Adler", part: "Airframe, recovery" }, { name: "Cara Diaz", part: "Ground station" }],
    search: "propulsion test, verified", major: "Aerospace Engineering", outcome: "SO 6 · Experimentation and analysis",
  },
];
