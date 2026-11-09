// Serves the map data in app/data/ (built by scripts/build_map_data.py) under /mapdata/.
//
// Used two ways:
//   - by Metro (metro.config.js), so `npx expo start` serves the app and its map data from one
//     address. That works on LAN, IPv6-only hotspots and `--tunnel` alike.
//   - by scripts/serve-data.mjs, a standalone server for checking the files on their own.
const { createReadStream, existsSync, statSync } = require("node:fs");
const { extname, join, normalize, resolve, sep } = require("node:path");
const { createGzip } = require("node:zlib");

const ROOT = resolve(__dirname, "../data");
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
  const url = new URL(req.url || "/", "http://x");
  if (!url.pathname.startsWith(PREFIX)) return false;
  res.setHeader("access-control-allow-origin", "*");
  const path = decodeURIComponent(url.pathname.slice(PREFIX.length - 1));
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep) || path.includes("/_")) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }
  let size;
  try {
    const st = statSync(file);
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
    createReadStream(file).pipe(createGzip()).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, "content-length": size });
  createReadStream(file).pipe(res);
  return true;
}

module.exports = { serveMapData, hasData, ROOT, PREFIX };
