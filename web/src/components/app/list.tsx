import Link from "next/link";
import { cn } from "@/lib/forge";

// Dense lists (docs/design/app.md): people, clubs, events, requests. One row each: a leading picture,
// a title (two lines on a phone, one from sm up), one meta line, one trailing action. Rows are separated by hairlines inside one bordered box,
// not boxed one by one. With `href` the whole row is a link (the trailing action sits outside it, so a
// button there never triggers the link).

export function List({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <ul aria-label={label} className={cn("divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]", className)}>{children}</ul>;
}

export function ListRow({ href, leading, title, meta, trailing }: { href?: string; leading?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode }) {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] font-medium break-words text-text sm:line-clamp-1 sm:text-sm">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-[13px] text-muted sm:text-xs">{meta}</span>}
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:py-2.5">
      {href
        ? <Link href={href} className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 transition hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">{body}</Link>
        : <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>}
      {trailing && <span className="shrink-0">{trailing}</span>}
    </li>
  );
}
