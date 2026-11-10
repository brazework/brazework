// Shapes and labels shared by the challenge pages.
export type Challenge = {
  id: string;
  org_id: string;
  title: string;
  brief: string;
  prize: string;
  topic: string;
  deadline: string;
  status: "draft" | "open" | "judging" | "closed";
  sponsorship: "unpaid" | "requested" | "paid" | "pilot";
  organizations: { name: string } | null;
};

export const STATUS_LABEL: Record<Challenge["status"], string> = { draft: "Draft", open: "Open", judging: "Judging", closed: "Winners announced" };
export const SPONSOR_LABEL: Record<Challenge["sponsorship"], string> = { unpaid: "Not sponsored yet", requested: "Pilot requested", paid: "Paid", pilot: "Pilot approved" };
export const PLACE = ["1st", "2nd", "3rd"];

export const daysLeft = (deadline: string, now: number) => Math.max(0, Math.ceil((Date.parse(deadline) - now) / 86400000));
