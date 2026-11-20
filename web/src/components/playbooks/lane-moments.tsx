"use client";
import { useState } from "react";
import { WORK_NOTE, type Lane } from "@/lib/lanes";
import { LaneSwitch } from "./lane-switch";

// One field's moments and who signs, on the public guide (/ai), for the lane picked: what an
// assistant records for a class or a club, and what it records for work. The guide opens on Studying,
// and each field keeps its own choice.
export type LaneView = { moments: { when: string; example: string; evidence: string }[]; signers: string };

export function LaneMoments({ lanes, initial = "study" }: { lanes: Record<Lane, LaneView>; initial?: Lane }) {
  const [lane, setLane] = useState<Lane>(initial);
  const part = lanes[lane];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 className="text-sm font-medium text-faint">Worth recording</h4>
        <LaneSwitch value={lane} onChange={setLane} />
      </div>
      <ul className="mt-3 flex flex-col gap-3 text-[15px]">
        {part.moments.map((m) => <li key={m.when}><span className="text-muted">{m.when}:</span> <span className="font-medium">&ldquo;{m.example}&rdquo;</span><span className="block text-sm text-faint">Proof: {m.evidence}</span></li>)}
      </ul>
      <p className="mt-4 text-[15px] text-muted">Signed by {part.signers}.</p>
      {lane === "work" && <p className="mt-2 text-sm text-faint">{WORK_NOTE}</p>}
    </div>
  );
}
