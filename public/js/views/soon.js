// Placeholder for sections designed in the prototype but not built yet.
const NAMES = { communities: "Communities", network: "Network", messages: "Messages", events: "Events", saved: "Saved", analytics: "Analytics", marketplace: "Marketplace" };

export function render({ view, name }) {
  view.innerHTML = `
    <div class="page"><section class="card rise" style="max-width:560px;margin:60px auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
      <h1 style="font-size:26px">${NAMES[name] || "This section"} is coming soon</h1>
      <p class="muted">It's designed and next in line to build.</p>
      <a class="btn" href="#/feed">Back to your feed</a>
    </section></div>`;
}
