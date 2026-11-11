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

// Resumable (TUS) uploads, like Storage's /storage/v1/upload/resumable (lib/storage-upload.ts sends
// files over 6 MB this way): POST creates an upload (it may carry the first piece), HEAD says how much
// has arrived, PATCH appends the next piece. Same rules as media.sql: your own folder, an allowed type,
// up to 250 MB (Pro). Only the media bucket is stored here; others are accepted and dropped.
const VIDEO_MAX = 250 * 1024 * 1024;
const uploads = new Map();
const TUS = { "tus-resumable": "1.0.0", "access-control-allow-origin": "*", "access-control-expose-headers": "Location, Upload-Offset, Upload-Length, Tus-Resumable" };
function resumable(req, res, url) {
  const id = url.slice("/storage/v1/upload/resumable".length).replace(/^\//, "");
  if (req.method === "POST" && !id) {
    const who = claims(req.headers.authorization);
    if (!who) return json(res, 401, { message: "Invalid JWT" });
    const meta = Object.fromEntries(String(req.headers["upload-metadata"] || "").split(",").filter(Boolean).map((kv) => { const [k, v] = kv.trim().split(" "); return [k, v ? Buffer.from(v, "base64").toString() : ""]; }));
    const length = Number(req.headers["upload-length"]);
    if (!Number.isFinite(length) || length <= 0) return json(res, 400, { message: "Upload-Length required" });
    if (length > VIDEO_MAX) return json(res, 413, { message: "The object exceeded the maximum allowed size" });
    if (meta.bucketName === "media") {
      if (String(meta.objectName || "").split("/")[0] !== who.sub || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(meta.objectName || "")) return json(res, 403, { message: "new row violates row-level security policy" });
      if (!TYPES[meta.contentType]) return json(res, 415, { message: `mime type ${meta.contentType} is not supported` });
    }
    const up = { bucket: meta.bucketName, rel: meta.objectName, length, offset: 0, chunks: [] };
    const key = crypto.randomUUID();
    uploads.set(key, up);
    const loc = `http://${req.headers.host}/storage/v1/upload/resumable/${key}`;
    return append(req, res, up, key, 201, { location: loc });
  }
  const up = uploads.get(id);
  if (!up) return json(res, 404, { message: "Upload not found" });
  if (req.method === "HEAD") { res.writeHead(200, { ...TUS, "upload-offset": String(up.offset), "upload-length": String(up.length), "cache-control": "no-store" }); return res.end(); }
  if (req.method === "PATCH") {
    if (Number(req.headers["upload-offset"]) !== up.offset) return json(res, 409, { message: "Offset mismatch" });
    return append(req, res, up, id, 204, {});
  }
  json(res, 405, { message: "Method not allowed" });
}
function append(req, res, up, key, code, extra) {
  req.on("data", (c) => { if (up.offset + c.length <= up.length) { up.chunks.push(c); up.offset += c.length; } });
  req.on("end", () => {
    if (up.offset === up.length) {
      if (up.bucket === "media") { const file = path.join(MEDIA, up.rel.replace(/\.\./g, "")); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat(up.chunks)); }
      up.chunks = [];
      uploads.delete(key);
    }
    res.writeHead(code, { ...TUS, ...extra, "upload-offset": String(up.offset) });
    res.end();
  });
}

http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  // GW_LOG: one line per request (time, ms, method, path, response bytes, server or browser), so a test can
  // total what one session costs in Supabase requests and egress.
  let bytes = 0;
  if (LOG) { const w = res.write.bind(res), e = res.end.bind(res); res.write = (c, ...a) => { if (c && typeof c !== "function") bytes += Buffer.byteLength(c); return w(c, ...a); }; res.end = (c, ...a) => { if (c && typeof c !== "function") bytes += Buffer.byteLength(c); return e(c, ...a); }; }
  res.on("finish", () => { if (LOG) fs.appendFileSync(LOG, `${Date.now()}\t${Number(process.hrtime.bigint() - t0) / 1e6}\t${req.method}\t${req.url.split("?")[0]}\t${bytes}\t${/Mozilla/.test(req.headers["user-agent"] || "") ? "browser" : "server"}\n`); });
  const url = req.url.split("?")[0];
  if (url.startsWith("/storage/v1/upload/resumable") && req.method === "OPTIONS") { res.writeHead(204, { ...TUS, "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "POST, HEAD, PATCH, OPTIONS", "access-control-max-age": "600" }); return res.end(); }
  if (url.startsWith("/storage/v1/upload/resumable")) return resumable(req, res, url);
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
  // An upstream that drops mid-response (a browser closing on a long request) must not take the gateway down.
  up.on("error", () => { if (res.headersSent) res.destroy(); else { res.writeHead(502); res.end(); } });
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" }); return res.end(); }
  req.pipe(up);
}).listen(54321, () => console.log("gateway on 54321"));
