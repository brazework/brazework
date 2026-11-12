// Is `path` on the page at `href`, or somewhere under it? Matches whole path segments, so "/pro"
// covers "/pro" and "/pro/queue" but never "/projects" (that lit up "Pro reviews" on project pages).
export const onPage = (path: string, href: string): boolean => {
  const base = href.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  return path === base || path.startsWith(base === "/" ? "/" : `${base}/`);
};
