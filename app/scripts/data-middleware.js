// Serves the map data in app/data/ (built by scripts/build_map_data.py) under /mapdata/.
//
// Used two ways:
//   - by Metro (metro.config.js), so `npx expo start` serves the app and its map data from one
//     address. That works on LAN, IPv6-only hotspots and `--tunnel` alike.
//   - by scripts/serve-data.mjs, a standalone server for checking the files on their own.
const { createReadStream, existsSync, realpathSync, statSync } = require("node:fs");
const { extname, join, normalize, resolve, sep } = require("node:path");
const { createGzip } = require("node:zlib");

const ROOT = resolve(__dirname, "../data");
const realRoot = () => { try { return realpathSync(ROOT); } catch { return ROOT; } };
const PREFIX = "/mapdata/";

const TYPES = {
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bin": "application/octet-stream",
};
const GZIP = new Set([".json", ".bin"]); // images are already compressed

const hasData = () => existsSync(join(ROOT, "manifest.json"));

/** Handles a /mapdata/... request and returns true, or returns false for any other URL. */
function serveMapData(req, res) {
  let url;
  try { url = new URL(req.url || "/", "http://x"); } catch { return false; }
  if (!url.pathname.startsWith(PREFIX)) return false;
  // Public, read-only science data: any origin may read it (the web app may run on another port),
  // but only with GET / HEAD.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("x-content-type-options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end("Method not allowed");
    return true;
  }
  let path;
  try {
    path = decodeURIComponent(url.pathname.slice(PREFIX.length - 1));
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return true;
  }
  const file = normalize(join(ROOT, path));
  // Stay inside data/, skip build caches (names starting with "_"), and refuse NUL bytes.
  if (!file.startsWith(ROOT + sep) || path.includes("/_") || path.includes("\0")) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }
  let size;
  try {
    // Resolve symlinks too: a link inside data/ must not lead outside it.
    const real = realpathSync(file);
    if (!real.startsWith(realRoot() + sep)) throw new Error("outside data/");
    const st = statSync(real);
    if (!st.isFile()) throw new Error("not a file");
    size = st.size;
  } catch {
    res.writeHead(404);
    res.end(hasData() ? "Not found" : "No map data: run python scripts/build_map_data.py (see app/README.md)");
    return true;
  }
  const ext = extname(file).toLowerCase();
  const headers = {
    "content-type": TYPES[ext] || "application/octet-stream",
    // The manifest changes on every build; everything else is keyed by its path.
    "cache-control": ext === ".json" ? "no-cache" : "public, max-age=3600",
  };
  if (GZIP.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    res.writeHead(200, { ...headers, "content-encoding": "gzip", vary: "accept-encoding" });
    if (req.method === "HEAD") { res.end(); return true; }
    createReadStream(file).on("error", () => res.destroy()).pipe(createGzip()).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, "content-length": size });
  if (req.method === "HEAD") { res.end(); return true; }
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
  return true;
}

module.exports = { serveMapData, hasData, ROOT, PREFIX };
