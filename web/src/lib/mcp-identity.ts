// Who the MCP server says it is when an assistant connects (the `serverInfo` in its initialize answer).
// `icons` and `websiteUrl` are the MCP standard's way for a server to give its own logo, so an
// assistant that reads them shows the current Brazework mark instead of a favicon some other service
// cached. The icons are the same drawings as the site's (app/app-icon, app/icon.svg), served from
// this site, so they change when the logo does. Assistants that don't know the fields ignore them.
// Tested in tests/mcp-identity.test.ts.

export function mcpServerInfo(site: string) {
  const base = site.replace(/\/$/, "");
  return {
    name: "brazework",
    title: "Brazework",
    version: "0.3.0",
    websiteUrl: base,
    icons: [
      { src: `${base}/app-icon/512`, mimeType: "image/png", sizes: ["512x512"] },
      { src: `${base}/app-icon/192`, mimeType: "image/png", sizes: ["192x192"] },
      { src: `${base}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
    ],
  };
}
