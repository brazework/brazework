"use client";
import { RsvpButton, SaveButton, useEventMarks } from "../event-controls";

export function DetailActions({ id, going, saved, count, over }: { id: string; going: boolean; saved: boolean; count: number; over: boolean }) {
  const { marks, rsvp, save, error } = useEventMarks(id, { going, saved, count });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {!over && <RsvpButton going={marks.going} onClick={rsvp} />}
        <SaveButton saved={marks.saved} onClick={save} />
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
