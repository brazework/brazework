// Local stand-in for Supabase's API gateway: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST.
const http = require("http");
const routes = [["/auth/v1", 59999], ["/rest/v1", 53000]];
const fs = require("fs");
const LOG = process.env.GW_LOG;
http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  res.on("finish", () => { if (LOG) fs.appendFileSync(LOG, `${Date.now()}\t${Number(process.hrtime.bigint() - t0) / 1e6}\t${req.method}\t${req.url.split("?")[0]}\n`); });
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404, { "access-control-allow-origin": "*" }); return res.end("{}"); }
  const headers = { ...req.headers, host: `localhost:${r[1]}` };
  const up = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers }, (u) => {
    res.writeHead(u.statusCode, { ...u.headers, "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" });
    u.pipe(res);
  });
  up.on("error", () => { res.writeHead(502); res.end(); });
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" }); return res.end(); }
  req.pipe(up);
}).listen(54321, () => console.log("gateway on 54321"));
