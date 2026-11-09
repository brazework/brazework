// Local stand-in for Supabase's API gateway: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST.
const http = require("http");
const routes = [["/auth/v1", 59999], ["/rest/v1", 53000]];
const fs = require("fs");
const LOG = process.env.GW_LOG;
http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  res.on("finish", () => { if (LOG) fs.appendFileSync(LOG, `${Date.now()}\t${Number(process.hrtime.bigint() - t0) / 1e6}\t${req.method}\t${req.url.split("?")[0]}\n`); });
  // Public Storage files, served from E2E_MEDIA_DIR (there's no Storage service locally).
  if (process.env.E2E_MEDIA_DIR && req.url.startsWith("/storage/v1/object/public/media/")) {
    const file = require("path").join(process.env.E2E_MEDIA_DIR, decodeURIComponent(req.url.split("?")[0].slice("/storage/v1/object/public/media/".length)).replace(/\.\./g, ""));
    return fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404); return res.end(); }
      const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".png") ? "image/png" : "image/jpeg";
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
      if (m) { const start = +m[1], end = m[2] ? +m[2] : st.size - 1; res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1, "access-control-allow-origin": "*" }); return fs.createReadStream(file, { start, end }).pipe(res); }
      res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": st.size, "access-control-allow-origin": "*" });
      fs.createReadStream(file).pipe(res);
    });
  }
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
