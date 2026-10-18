// Applies the saved appearance settings to the whole app.
export function applyTheme() {
  let t = "dark", m = "full", s = "default", a = "";
  try {
    t = localStorage.getItem("forge.theme") || "dark";
    m = localStorage.getItem("forge.motion") || "full";
    s = localStorage.getItem("forge.textSize") || "default";
    a = localStorage.getItem("forge.accent") || "";
  } catch (e) {}
  const mode = t === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", mode);
  if (m === "reduce") root.setAttribute("data-motion", "reduce"); else root.removeAttribute("data-motion");
  root.classList.toggle("large-text", s === "large");
  if (a) root.style.setProperty("--accent", a); else root.style.removeProperty("--accent");
  setTimeout(() => root.classList.remove("theme-switching"), 400);
}

