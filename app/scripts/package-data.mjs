// Packs the built map data (app/data/) into one archive for a GitHub Release, so CI (the Pages
// workflow, .github/workflows/deploy.yml) and teammates can use the data without running the pipeline.
//
//   npm run data:pack                         # from app/; writes to <system temp>/mars-navigator-data/
//   npm run data:pack -- --out <dir>          # somewhere else (must be outside app/)
//   npm run data:pack -- --tag <release tag>  # tag shown in the printed upload commands (default map-data)
//
// Writes two files:
//   mapdata.tar.gz         data/... (what the app loads) plus data/ARCHIVE.json (what's inside, when built)
//   mapdata.tar.gz.sha256  "<sha256>  mapdata.tar.gz", checked by `sha256sum -c` and fetch-data.mjs
// Left out: build caches (names starting with "_", which the data server refuses too), the
// *_equirect.jpg panorama previews (written by build_panos.py, never loaded by the app) and OS junk.
// The tar stream is written here with Node built-ins, so it packs the same on Windows, macOS and
// Linux. It prints the `gh release` commands to upload the files; it does not run them.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(APP, "data");
export const ARCHIVE = "mapdata.tar.gz";

/** Whether a path under data/ (posix, relative) belongs in the archive. */
export function keep(rel) {
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  if (parts.some(p => p.startsWith("_") || p.startsWith("."))) return false; // caches, __MACOSX, ._*, .DS_Store
  if (name === "Thumbs.db" || name === "Desktop.ini") return false;
  if (/_equirect\.jpg$/i.test(name)) return false; // panorama previews, not loaded by the app
  return true;
}

/** Windows' own tar (bsdtar) understands C:\ paths; Git Bash's GNU tar would read "C:" as a host. */
export function tarBin() {
  if (process.platform === "win32") {
    const sys = join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    if (existsSync(sys)) return sys;
  }
  return "tar";
}

export function sha256(file) {
  return new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(file).on("error", fail).on("data", d => h.update(d)).on("end", () => ok(h.digest("hex")));
  });
}

// --- a minimal ustar writer (regular files only; names here are short ASCII) ---

function header(name, size, mtime) {
  if (Buffer.byteLength(name) > 100) throw new Error(`path too long for the archive: ${name}`);
  const h = Buffer.alloc(512);
  const put = (s, off, len) => h.write(s, off, len, "ascii");
  const oct = (n, len) => n.toString(8).padStart(len - 1, "0") + "\0";
  put(name, 0, 100);
  put(oct(0o644, 8), 100, 8);
  put(oct(0, 8), 108, 8); // uid
  put(oct(0, 8), 116, 8); // gid
  put(oct(size, 12), 124, 12);
  put(oct(Math.floor(mtime / 1000), 12), 136, 12);
  put("        ", 148, 8); // checksum placeholder: 8 spaces
  put("0", 156, 1); // regular file
  put("ustar\0" + "00", 257, 8);
  let sum = 0;
  for (const b of h) sum += b;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}

async function* tarStream(entries) {
  for (const { name, file, body } of entries) {
    const st = file ? statSync(file) : null;
    const size = st ? st.size : body.length;
    yield header(name, size, st ? st.mtimeMs : Date.now());
    if (file) {
      let n = 0;
      for await (const chunk of createReadStream(file)) { n += chunk.length; yield chunk; }
      if (n !== size) throw new Error(`${file} changed while packing`);
    } else {
      yield body;
    }
    if (size % 512) yield Buffer.alloc(512 - (size % 512));
  }
  yield Buffer.alloc(1024); // end of archive
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p); // symlinks are skipped: the archive holds real files only
  }
  return out;
}

const mb = n => `${(n / 1e6).toFixed(1)} MB`;

async function main() {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
  };
  const OUT = resolve(arg("--out", join(tmpdir(), "mars-navigator-data")));
  const TAG = arg("--tag", "map-data");

  if (!existsSync(join(DATA, "manifest.json"))) {
    console.error(`\n  No map data in ${DATA}.\n  Build it first: python scripts/build_map_data.py (see app/README.md).\n`);
    process.exit(1);
  }
  if (OUT === APP || OUT.startsWith(APP + sep)) {
    console.error(`\n  --out must be outside app/ (got ${OUT}), so the archive is never committed or served.\n`);
    process.exit(1);
  }

  const all = walk(DATA).map(f => relative(DATA, f).split(sep).join("/"));
  const files = all.filter(keep).sort();
  const skipped = all.length - files.length;
  const bytes = files.reduce((n, f) => n + statSync(join(DATA, f)).size, 0);
  const manifest = JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8"));
  const info = Buffer.from(JSON.stringify({ created: new Date().toISOString(), manifest_built: manifest.built ?? null, files: files.length, bytes }, null, 2) + "\n");

  mkdirSync(OUT, { recursive: true });
  const archive = join(OUT, ARCHIVE);
  const partial = `${archive}.partial`;
  console.log(`Packing ${files.length} files (${mb(bytes)}) from ${DATA} ...`);
  const entries = [...files.map(f => ({ name: `data/${f}`, file: join(DATA, f) })), { name: "data/ARCHIVE.json", body: info }];
  await pipeline(Readable.from(tarStream(entries)), createGzip({ level: 9 }), createWriteStream(partial));
  rmSync(`${archive}.sha256`, { force: true });
  renameSync(partial, archive);

  const hash = await sha256(archive);
  writeFileSync(`${archive}.sha256`, `${hash}  ${ARCHIVE}\n`);
  const posix = p => p.split(sep).join("/");

  console.log(`
  Archive:  ${archive}
  Size:     ${mb(statSync(archive).size)}  (${files.length} files, ${mb(bytes)} unpacked; ${skipped} skipped: caches, previews, OS junk)
  SHA-256:  ${hash}

  Upload both files as assets of the "${TAG}" release (GitHub CLI, signed in, run from the repo):

    First time:
      gh release create ${TAG} "${posix(archive)}" "${posix(archive)}.sha256" --title "Map data" --notes "Packed app/data/ for the web demo (see app/README.md)." --latest=false

    To replace the data later:
      gh release upload ${TAG} "${posix(archive)}" "${posix(archive)}.sha256" --clobber

  Then run the "Deploy web demo" workflow (Actions tab) to publish it.
`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err.message || err); process.exit(1); });
}
