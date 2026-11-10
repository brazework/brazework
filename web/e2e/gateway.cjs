// Local stand-in for Supabase's API gateway: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST.
const http = require("http");
// Auth and REST listen below Linux's ephemeral port range (32768-60999), so a busy CI machine's
// outgoing connections can't already hold them (that failed a run with "address already in use").
const routes = [["/auth/v1", 19999], ["/rest/v1", 13000]];
const fs = require("fs");
const LOG = process.env.GW_LOG;
const crypto = require("crypto");
const path = require("path");
// Storage files live here (there's no Storage service locally). Uploads follow media.sql's rules.
const MEDIA = process.env.E2E_MEDIA_DIR || path.join(__dirname, ".media");
const SECRET = process.env.GW_JWT_SECRET || "";
const TYPES = { "image/jpeg": 1, "image/png": 1, "image/webp": 1, "image/gif": 1, "video/mp4": 1, "video/webm": 1, "video/quicktime": 1 };
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };

// The signed-in member, from a GoTrue token signed with the local secret.
function claims(auth) {
  const [h, p, sig] = String(auth || "").replace(/^Bearer /i, "").split(".");
  if (!sig || !SECRET) return null;
  if (crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") !== sig) return null;
  const c = JSON.parse(Buffer.from(p, "base64url").toString());
  return c.exp && c.exp * 1000 < Date.now() ? null : c;
}

// The file in a multipart upload (supabase-js and supabase-swift both send one), or the raw body.
function filePart(body, type) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type || "");
  if (!m) return { data: body, type: (type || "").split(";")[0] };
  const b = Buffer.from(`--${m[1] || m[2]}`);
  let at = body.indexOf(b), found = null;
  while (at !== -1) {
    const next = body.indexOf(b, at + b.length);
    if (next === -1) break;
    const part = body.subarray(at + b.length + 2, next - 2);
    const split = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, split).toString();
    if (/filename=|name=""/i.test(head) || /content-type:\s*(image|video)\//i.test(head)) found = { data: part.subarray(split + 4), type: (/content-type:\s*([^\r\n;]+)/i.exec(head) || [])[1] };
    at = next;
  }
  return found;
}

function upload(req, res, rel) {
  const who = claims(req.headers.authorization);
  if (!who) return json(res, 400, { statusCode: "403", error: "Unauthorized", message: "Invalid JWT" });
  if (rel.split("/")[0] !== who.sub || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(rel)) return json(res, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
  const chunks = []; let size = 0;
  req.on("data", (c) => { size += c.length; if (size <= 52 * 1024 * 1024) chunks.push(c); });
  req.on("end", () => {
    if (size > 50 * 1024 * 1024 + 4096) return json(res, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
    const f = filePart(Buffer.concat(chunks), req.headers["content-type"]);
    if (!f || !TYPES[f.type]) return json(res, 400, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${f && f.type} is not supported` });
    const file = path.join(MEDIA, rel);
    if (fs.existsSync(file) && req.headers["x-upsert"] !== "true") return json(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, f.data);
    json(res, 200, { Key: `media/${rel}`, Id: crypto.randomUUID() });
  });
}

http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  res.on("finish", () => { if (LOG) fs.appendFileSync(LOG, `${Date.now()}\t${Number(process.hrtime.bigint() - t0) / 1e6}\t${req.method}\t${req.url.split("?")[0]}\n`); });
  const url = req.url.split("?")[0];
  if (req.method === "OPTIONS" && url.startsWith("/storage/")) { res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" }); return res.end(); }
  if ((req.method === "POST" || req.method === "PUT") && url.startsWith("/storage/v1/object/media/")) return upload(req, res, decodeURIComponent(url.slice("/storage/v1/object/media/".length)));
  // Public Storage files.
  if (req.url.startsWith("/storage/v1/object/public/media/")) {
    const file = path.join(MEDIA, decodeURIComponent(req.url.split("?")[0].slice("/storage/v1/object/public/media/".length)).replace(/\.\./g, ""));
    return fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404); return res.end(); }
      const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".mov") ? "video/quicktime" : file.endsWith(".webm") ? "video/webm" : file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".gif") ? "image/gif" : "image/jpeg";
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
