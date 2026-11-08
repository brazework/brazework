import { eventCols } from "@/lib/db-features";
import { NextResponse, type NextRequest } from "next/server";
import { calendarFile, calendarFileName, type ForgeEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

// "Add to calendar": a standard .ics file (Google, Apple and Outlook all open it). Row-level security applies.
export async function GET(_req: NextRequest, { params }: RouteContext<"/events/[id]/ics">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(await eventCols()).eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Event not found", { status: 404 });
  const e = data as unknown as ForgeEvent;
  return new NextResponse(calendarFile(e, Date.now()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarFileName(e.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
