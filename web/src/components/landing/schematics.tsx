import { cn } from "@/lib/forge";

// Line-art schematics, one per STEM field, drawn like a sketch on an engineering pad.
// Every stroke has pathLength=1 and the class .sch-line, so CSS can draw it in:
// .sch-draw draws on mount, .sch-scroll draws as it scrolls into view, .sch-hover redraws on hover.
// Pure SVG with no hooks, so it renders on the server and inside client components.

type SVGProps = React.SVGProps<SVGPathElement>;
const P = (p: SVGProps) => <path pathLength={1} className="sch-line" {...p} />;
const C = (p: React.SVGProps<SVGCircleElement>) => <circle pathLength={1} className="sch-line" {...p} />;
const E = (p: React.SVGProps<SVGEllipseElement>) => <ellipse pathLength={1} className="sch-line" {...p} />;
const T = ({ x, y, children, anchor = "start" }: { x: number; y: number; children: React.ReactNode; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} textAnchor={anchor} className="sch-label" fill="currentColor" stroke="none" fontSize="7" fontFamily="var(--font-mono)">{children}</text>
);
const f = (n: number) => Math.round(n * 10) / 10;

// A spur gear outline: n teeth between radius r (root) and r + 5 (tip).
function gear(cx: number, cy: number, r: number, n: number) {
  const step = (Math.PI * 2) / n;
  const pt = (rad: number, a: number) => `${f(cx + rad * Math.cos(a))} ${f(cy + rad * Math.sin(a))}`;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = i * step;
    d += `${i ? "L" : "M"}${pt(r, a)} L${pt(r + 5, a + step * 0.15)} L${pt(r + 5, a + step * 0.45)} L${pt(r, a + step * 0.6)} `;
  }
  return d + "Z";
}

// y = f(x) sampled into a path.
function plot(x0: number, x1: number, fn: (x: number) => number, step = 2) {
  let d = "";
  for (let x = x0; x <= x1; x += step) d += `${x === x0 ? "M" : "L"}${f(x)} ${f(fn(x))} `;
  return d;
}

const arrow = (x: number, y: number, dir: "down" | "right" | "up" | "left") =>
  ({ down: `M${x - 3} ${y - 5} L${x} ${y} L${x + 3} ${y - 5}`, up: `M${x - 3} ${y + 5} L${x} ${y} L${x + 3} ${y + 5}`, right: `M${x - 5} ${y - 3} L${x} ${y} L${x - 5} ${y + 3}`, left: `M${x + 5} ${y - 3} L${x} ${y} L${x + 5} ${y + 3}` })[dir];

const DRAWINGS: Record<string, React.ReactNode> = {
  mechanical: (
    <>
      <P d={gear(52, 50, 22, 12)} />
      <C cx={52} cy={50} r={7} />
      <P d="M46 50 H58 M52 44 V56" strokeWidth={0.75} />
      <P d={gear(91, 37, 12, 7)} />
      <C cx={91} cy={37} r={4} />
      <P d="M101 34 H150 V40 H101" />
      <P d="M30 88 H74 M30 84 V92 M74 84 V92" strokeWidth={0.75} />
      <T x={52} y={98} anchor="middle">Ø44 · 12T</T>
      <T x={120} y={30}>7T</T>
    </>
  ),
  electrical: (
    <>
      <P d="M20 54 V30 H52 l3 -6 l6 12 l6 -12 l6 12 l6 -12 l3 6 H140 V46" />
      <P d="M130 46 H150 M130 54 H150" />
      <P d="M140 54 V75 H100 M86 75 H20 V60" />
      <P d="M100 68 V82 L88 75 Z M86 68 V82" />
      <P d="M93 64 l5 -6 M98 64 l5 -6" strokeWidth={0.75} />
      <P d="M12 60 H28 M16 54 H24" />
      <C cx={140} cy={30} r={1.5} />
      <C cx={20} cy={75} r={1.5} />
      <T x={58} y={18}>R1 4.7kΩ</T>
      <T x={153} y={52}>C1</T>
      <T x={4} y={68}>9V</T>
    </>
  ),
  civil: (
    <>
      <P d="M10 70 H150" />
      <P d="M10 70 L30 40 H130 L150 70" />
      <P d="M30 40 L50 70 L70 40 L90 70 L110 40 L130 70" />
      <P d="M50 40 V70 M70 40 V70 M90 40 V70 M110 40 V70" strokeWidth={0.75} />
      <P d="M10 70 l-6 10 h12 Z" />
      <C cx={150} cy={75} r={4} />
      <P d="M2 84 H22 M140 80 H160" strokeWidth={0.75} />
      <P d={`M80 14 V36 ${arrow(80, 37, "down")}`} />
      <T x={86} y={22}>P = 2.5 kN</T>
    </>
  ),
  aerospace: (
    <>
      <P d="M20 55 C40 33 92 30 142 52 C100 58 50 63 20 55 Z" />
      <P d="M20 55 L142 52" strokeDasharray="0.02 0.015" strokeWidth={0.75} />
      <P d="M4 36 C40 26 100 20 156 36" strokeWidth={0.9} />
      <P d="M4 76 C50 76 100 70 156 62" strokeWidth={0.9} />
      <P d="M4 24 C50 14 110 10 156 22" strokeWidth={0.75} />
      <P d={`M4 55 H17 ${arrow(18, 55, "right")}`} />
      <P d={`M78 40 V12 ${arrow(78, 11, "up")}`} />
      <T x={84} y={16}>L</T>
      <T x={4} y={92}>NACA 2412 · α = 4°</T>
    </>
  ),
  chemical: (
    <>
      <P d="M40 30 V51 A18 18 0 1 0 48 51 V30" />
      <P d="M28 72 H60" strokeWidth={0.75} />
      <C cx={40} cy={78} r={1.5} />
      <C cx={48} cy={82} r={2} />
      <P d="M44 30 V20 H90 L128 50" />
      <P d="M88 14 L132 45 M84 26 L124 56" strokeWidth={0.75} />
      <P d="M118 60 V88 H150 V60 M118 80 H150" />
      <P d="M134 54 q2 4 0 6 q-2 -2 0 -6" />
      <P d="M30 96 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0" strokeWidth={0.9} />
      <T x={64} y={40}>T = 78 °C</T>
    </>
  ),
  biomedical: (
    <>
      <P d="M4 64 H38 l5 -4 l5 4 H58 l4 8 l6 -42 l6 52 l4 -18 H96 q6 -10 12 0 H156" />
      <P d="M128 26 c-6 -10 -20 -4 -14 8 l14 12 l14 -12 c6 -12 -8 -18 -14 -8 Z" />
      <P d="M4 88 H156" strokeWidth={0.5} strokeDasharray="0.01 0.012" />
      <T x={4} y={22}>ECG · lead II</T>
      <T x={100} y={84}>72 bpm</T>
    </>
  ),
  cs: (
    <>
      <P d="M62 6 H98 a7 7 0 0 1 0 14 H62 a7 7 0 0 1 0 -14 Z" />
      <P d={`M80 20 V27 ${arrow(80, 28, "down")}`} />
      <P d="M56 28 H104 V42 H56 Z" />
      <P d={`M80 42 V47 ${arrow(80, 48, "down")}`} />
      <P d="M80 48 L98 60 L80 72 L62 60 Z" />
      <P d={`M98 60 H125 V69 ${arrow(125, 70, "down")}`} />
      <P d="M105 70 H145 V84 H105 Z" />
      <P d={`M62 60 H35 V69 ${arrow(35, 70, "down")}`} />
      <P d="M15 70 H55 V84 H15 Z" />
      <P d={`M15 77 H8 V35 H55 ${arrow(56, 35, "right")}`} strokeWidth={0.9} />
      <T x={80} y={15} anchor="middle">start</T>
      <T x={102} y={57}>yes</T>
      <T x={48} y={57}>no</T>
    </>
  ),
  ai: (
    <>
      {[25, 50, 75].flatMap((a) => [18, 40, 62, 84].map((b) => <P key={`a${a}${b}`} d={`M36 ${a} L74 ${b}`} strokeWidth={0.6} />))}
      {[18, 40, 62, 84].flatMap((a) => [38, 62].map((b) => <P key={`b${a}${b}`} d={`M86 ${a} L124 ${b}`} strokeWidth={0.6} />))}
      {[25, 50, 75].map((y) => <C key={`n1${y}`} cx={30} cy={y} r={6} />)}
      {[18, 40, 62, 84].map((y) => <C key={`n2${y}`} cx={80} cy={y} r={6} />)}
      {[38, 62].map((y) => <C key={`n3${y}`} cx={130} cy={y} r={6} />)}
      <T x={30} y={97} anchor="middle">input</T>
      <T x={130} y={80} anchor="middle">output</T>
    </>
  ),
  physics: (
    <>
      <E cx={80} cy={50} rx={46} ry={14} />
      <E cx={80} cy={50} rx={46} ry={14} transform="rotate(60 80 50)" />
      <E cx={80} cy={50} rx={46} ry={14} transform="rotate(120 80 50)" />
      <C cx={80} cy={50} r={5} />
      <C cx={126} cy={50} r={2.5} />
      <C cx={57} cy={90} r={2.5} />
      <C cx={57} cy={10} r={2.5} />
      <T x={130} y={92}>e⁻</T>
    </>
  ),
  chemistry: (
    <>
      <P d="M65 30 L84 41 L84 63 L65 74 L46 63 L46 41 Z" />
      <C cx={65} cy={52} r={12} />
      <P d="M65 30 V16" />
      <P d="M84 41 L104 30 L124 41" />
      <P d="M102 30 V14 M106 30 V14" />
      <P d="M46 63 L28 74" />
      <T x={60} y={12}>OH</T>
      <T x={100} y={10}>O</T>
      <T x={126} y={45}>OH</T>
      <T x={14} y={82}>CH₃</T>
    </>
  ),
  biology: (
    <>
      <P d={plot(8, 152, (x) => 50 + 24 * Math.sin(x / 13))} />
      <P d={plot(8, 152, (x) => 50 - 24 * Math.sin(x / 13))} />
      <P d={Array.from({ length: 18 }, (_, i) => 12 + i * 8).filter((x) => Math.abs(Math.sin(x / 13)) > 0.3).map((x) => `M${x} ${f(50 + 24 * Math.sin(x / 13))} V${f(50 - 24 * Math.sin(x / 13))}`).join(" ")} strokeWidth={0.75} />
      <T x={4} y={96}>5′ ATG CCA GTA 3′</T>
    </>
  ),
  math: (
    <>
      <P d={`M14 84 H152 ${arrow(153, 84, "right")}`} />
      <P d={`M20 92 V8 ${arrow(20, 7, "up")}`} />
      <P d={[54, 60, 66, 72, 78, 84].map((x) => `M${x} 84 V${f(64 - 26 * Math.sin((x - 20) / 22))}`).join(" ")} strokeWidth={0.6} />
      <P d={plot(20, 146, (x) => 64 - 26 * Math.sin((x - 20) / 22))} />
      <P d="M88 14 L148 54" strokeWidth={0.75} />
      <T x={26} y={14}>f(x)</T>
      <T x={56} y={96}>∫ f(x) dx</T>
    </>
  ),
};

export function Schematic({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 160 100" className={cn("overflow-visible", className)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {DRAWINGS[id]}
    </svg>
  );
}
