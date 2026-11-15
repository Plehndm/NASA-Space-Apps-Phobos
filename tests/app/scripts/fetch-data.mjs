// Downloads the packed map data (scripts/package-data.mjs) from a GitHub Release, checks its SHA-256
// and unpacks it. Lets you run the app without the data pipeline; the Pages workflow uses it too.
//
//   npm run data:fetch                          # into app/data/ (refuses to overwrite without --force)
//   npm run data:fetch -- --dest dist/mapdata   # somewhere else (relative to app/)
//   npm run data:fetch -- --archive <file>      # use a local mapdata.tar.gz (+ .sha256 beside it)
//   npm run data:fetch -- --tag map-data --repo Plehndm/NASA-Space-Apps-Phobos
//
// Downloads with the GitHub CLI (`gh`) when it is installed, which also works on a private repo;
// otherwise from the public release URL.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVE, sha256, tarBin } from "./package-data.mjs";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const TAG = arg("--tag", process.env.MAP_DATA_TAG || "map-data");
const REPO = arg("--repo", process.env.GITHUB_REPOSITORY || "Plehndm/NASA-Space-Apps-Phobos");
const DEST = resolve(APP, arg("--dest", "data"));
const LOCAL = arg("--archive", null);
const FORCE = process.argv.includes("--force");

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const fail = msg => { console.error(`\n  ${msg}\n`); process.exit(1); };

async function download(dir) {
  const gh = run("gh", ["--version"]);
  if (!gh.error && gh.status === 0) {
    console.log(`Downloading ${ARCHIVE} from release "${TAG}" of ${REPO} with gh ...`);
    const r = run("gh", ["release", "download", TAG, "--repo", REPO, "--dir", dir, "--pattern", ARCHIVE, "--pattern", `${ARCHIVE}.sha256`, "--clobber"], { stdio: "inherit" });
    if (r.status !== 0) fail(`gh release download failed. Does release "${TAG}" exist with ${ARCHIVE} and ${ARCHIVE}.sha256?`);
    return;
  }
  for (const name of [ARCHIVE, `${ARCHIVE}.sha256`]) {
    const url = `https://github.com/${REPO}/releases/download/${TAG}/${name}`;
    console.log(`Downloading ${url} ...`);
    const res = await fetch(url);
    if (!res.ok) fail(`HTTP ${res.status} for ${url}. (Private repo? Install the GitHub CLI and run gh auth login.)`);
    writeFileSync(join(dir, name), Buffer.from(await res.arrayBuffer()));
  }
}

async function main() {
  if (existsSync(join(DEST, "manifest.json")) && !FORCE) fail(`${DEST} already has map data. Pass --force to unpack over it.`);

  const work = mkdtempSync(join(tmpdir(), "mapdata-fetch-"));
  try {
    let archive;
    if (LOCAL) {
      archive = resolve(LOCAL);
      if (!existsSync(archive) || !existsSync(`${archive}.sha256`)) fail(`Need ${archive} and ${archive}.sha256.`);
    } else {
      await download(work);
      archive = join(work, ARCHIVE);
    }

    const want = readFileSync(`${archive}.sha256`, "utf8").trim().split(/\s+/)[0].toLowerCase();
    const got = await sha256(archive);
    if (!/^[0-9a-f]{64}$/.test(want) || want !== got) fail(`Checksum mismatch for ${archive}: expected ${want}, got ${got}.`);
    console.log(`SHA-256 OK (${got}).`);

    // Every entry must sit under data/ with no ".." or absolute paths before anything is written.
    const list = run(tarBin(), ["-tzf", archive], { maxBuffer: 64 << 20 });
    if (list.status !== 0) fail(`Could not read ${archive}: ${list.stderr}`);
    const bad = list.stdout.split(/\r?\n/).filter(Boolean).filter(p => !p.startsWith("data/") || p.split(/[\\/]/).includes("..") || p.includes(":"));
    if (bad.length) fail(`Unexpected paths in the archive, refusing to unpack: ${bad.slice(0, 5).join(", ")}`);

    mkdirSync(DEST, { recursive: true });
    const x = run(tarBin(), ["-xzf", archive, "-C", DEST, "--strip-components=1"], { stdio: "inherit" });
    if (x.status !== 0) fail("tar could not unpack the archive.");
    if (!existsSync(join(DEST, "manifest.json"))) fail(`Unpacked, but ${DEST}/manifest.json is missing.`);
    console.log(`Map data unpacked into ${DEST}.`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch(err => fail(err.message || String(err)));
