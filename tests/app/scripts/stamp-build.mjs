// Makes a GitHub Pages deploy show up without a manual refresh.
//
// Pages tells browsers to cache every file for 10 minutes, so after a deploy a link opens the old copy
// until the visitor reloads. This writes <dist>/version.json with the build id and adds a small script
// to each HTML page: on load it fetches version.json past the cache, and if the build is newer than the
// page, it re-opens the same address with ?v=<build>. A new address isn't in the cache, so the browser
// gets the new page. The ?v= guard stops it from ever reloading twice.
//
//   node scripts/stamp-build.mjs <dist> <base path> <build id>
//   node scripts/stamp-build.mjs dist /NASA-Space-Apps-Phobos "$GITHUB_SHA"
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dist, base, build] = process.argv.slice(2);
if (!dist || base === undefined || !/^[A-Za-z0-9._-]{1,64}$/.test(build || "")) {
  console.error("usage: node scripts/stamp-build.mjs <dist> <base path> <build id>");
  process.exit(1);
}

const versionUrl = `${base.replace(/\/$/, "")}/version.json`;
writeFileSync(join(dist, "version.json"), JSON.stringify({ build }) + "\n");

const script = `<script>(function(){var b=${JSON.stringify(build)};try{fetch(${JSON.stringify(versionUrl)},{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(v){if(!v||!v.build||v.build===b)return;var u=new URL(location.href);if(u.searchParams.get("v")===v.build)return;u.searchParams.set("v",v.build);location.replace(u.href)}).catch(function(){})}catch(e){}})();</script>`;

for (const page of ["index.html", "404.html", "showcase/index.html"]) {
  const file = join(dist, page);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  if (!html.includes("</head>")) throw new Error(`${page} has no </head>`);
  writeFileSync(file, html.replace("</head>", `${script}</head>`));
  console.log(`stamped ${page}`);
}
console.log(`build ${build} -> ${versionUrl}`);
