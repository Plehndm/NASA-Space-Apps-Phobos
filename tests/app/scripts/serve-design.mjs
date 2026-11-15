// Serves the legacy HTML design prototype ("Mars Navigator App Design/design") so it can be
// compared side by side with the real app. The prototype loads its own files with fetch(),
// which browsers block for file:// pages, so it needs a web server.
//
//   npm run design            # from app/, then open the printed links
//   npm run design -- 8091    # different port
//
// Reference only: nothing here is part of the app.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../Mars Navigator App Design/design");
const PORT = Number(process.argv[2]) || 8090;

const PAGES = [
  ["Phone (393×852)", "Mars Navigator v2.dc.html"],
  ["Desktop (1440×900)", "Mars Navigator Desktop.dc.html"],
  ["Slide deck", "Mars Navigator Deck.dc.html"],
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const index = () => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design reference</title>
<style>body{margin:0;padding:32px 20px;background:#140b09;color:#f8ece4;font:15px/1.5 system-ui,sans-serif}
main{max-width:520px;margin:auto}a{display:block;padding:14px 18px;margin:10px 0;border-radius:18px;background:#36251f;color:#cdf3ea;text-decoration:none;font-weight:600}
a:hover{background:#47322a}p{color:#dcb9a6}small{color:#ab8878}</style>
<main><h1>Mars Navigator: design reference</h1>
<p>The legacy HTML prototype from "Mars Navigator App Design". Use it to compare against the real app in <code>app/</code>; it is not the app.</p>
${PAGES.map(([label, file]) => `<a href="/${encodeURI(file)}">${label}</a>`).join("")}
<small>Scenes: the phone and desktop files open on Home. In the deck, every slide is a live scene.</small></main>`;

const server = createServer((req, res) => {
  // A malformed URL (bad % escape) must not throw: that would crash the whole server.
  let path;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }
  if (path === "/") {
    res.writeHead(200, { "content-type": TYPES[".html"] });
    return res.end(index());
  }
  // Stay inside the design folder.
  const file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    if (!statSync(file).isFile()) throw new Error("not a file");
  } catch {
    res.writeHead(404);
    return res.end("Not found");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find(a => a && a.family === "IPv4" && !a.internal)?.address;
  console.log(`\n  Design reference (legacy HTML prototype), serving ${ROOT}\n`);
  console.log(`  Desktop:  http://localhost:${PORT}/`);
  if (lan) console.log(`  Phone:    http://${lan}:${PORT}/   (same Wi-Fi)`);
  console.log(`\n  Ctrl+C to stop.\n`);
});
