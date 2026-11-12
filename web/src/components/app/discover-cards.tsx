import { FlaskConical, Heart, HelpCircle, MapPin, MessageSquare, Megaphone, Rocket, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { dateParts, type HostedEvent } from "@/lib/events";
import { type Post } from "@/lib/forge";
import { avatarSrc, mediaUrl } from "@/lib/media";

const KIND = { update: { icon: Megaphone, label: "Update" }, question: { icon: HelpCircle, label: "Question" }, result: { icon: FlaskConical, label: "Result" }, project: { icon: Rocket, label: "Project" } } as const;

// A post as a cover card: its first photo, or the theme gradient with the post type.
export function SpotlightCard({ post }: { post: Post }) {
  const k = KIND[post.kind] ?? KIND.update;
  const photo = post.media?.find((m) => m.type === "image");
  return (
    <Link prefetch={false} href={`/post/${post.id}`} className="grad-edge group flex w-[280px] flex-col overflow-hidden rounded-3xl border shadow-[var(--shadow)] transition duration-300">
      <div className="relative h-40 overflow-hidden">
        {photo ? (
          <Image src={mediaUrl(photo.path)} alt={photo.alt || ""} fill sizes="280px" className="object-cover transition duration-700 group-hover:scale-110" />
        ) : (
          <div className="bg-accent-grad absolute inset-0 grid place-items-center transition duration-700 group-hover:scale-110">
            <k.icon className="size-14 text-on-accent opacity-80" />
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur"><k.icon className="size-3.5" /> {k.label}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-text-2">{post.body}</p>
        <div className="mt-auto flex items-center gap-2 pt-4">
          <Avatar first={post.author_first} last={post.author_last} size={24} src={avatarSrc(post.author)} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{post.author_first} {post.author_last}</span>
          <span className="inline-flex items-center gap-1 text-xs text-faint"><Heart className="size-3.5" /> {post.like_count}</span>
          <span className="inline-flex items-center gap-1 text-xs text-faint"><MessageSquare className="size-3.5" /> {post.comment_count}</span>
        </div>
      </div>
    </Link>
  );
}

// An event as a compact ticket: a date block, what it is, who's hosting, how many are going.
export function EventMiniCard({ e, going }: { e: HostedEvent; going?: boolean }) {
  const d = dateParts(e.starts_at, "UTC");
  return (
    <Link prefetch={false} href={`/events/${e.id}`} className="grad-edge group flex w-[250px] gap-3 rounded-3xl border p-4 shadow-[var(--shadow)] transition duration-300">
      <span className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 group-hover:-rotate-3">
        <span className="bg-accent-grad w-full py-1 text-center text-[10px] font-bold text-on-accent uppercase">{d.mon}</span>
        <span className="py-1.5 text-xl leading-none font-semibold">{d.day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold">{e.title}</span>
        <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted"><MapPin className="size-3 shrink-0" /> {e.format === "Online" ? "Online" : e.location || e.format}</span>
        <span className="mt-1 flex items-center gap-1 text-xs whitespace-nowrap text-faint">
          {going ? <span className="font-medium text-ok">✓ Going</span> : <><Users className="size-3 shrink-0" /> {e.rsvp_count} going</>}
        </span>
        <span className="block truncate text-xs text-faint">{e.host}</span>
      </span>
    </Link>
  );
}

export function StripSkeleton({ w = 260, h = 220 }: { w?: number; h?: number }) {
  return (
    <div aria-hidden="true">
      <div className="shimmer mb-3 h-7 w-40 rounded-lg" />
      <div className="flex gap-3 overflow-hidden">{[0, 1, 2].map((i) => <div key={i} className="shimmer shrink-0 rounded-3xl" style={{ width: w, height: h }} />)}</div>
    </div>
  );
}

