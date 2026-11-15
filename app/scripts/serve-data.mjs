// Standalone server for the map data in app/data/, at http://localhost:8092/mapdata/.
//
// You don't need this to run the app: `npx expo start` serves the same files at /mapdata/
// (metro.config.js). Use it to check the data on its own, or to point the app at another
// machine with EXPO_PUBLIC_DATA_URL=http://<host>:8092/mapdata.
//
//   npm run data              # from app/
//   npm run data -- 8093      # different port
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";

const { serveMapData, hasData, ROOT } = createRequire(import.meta.url)("./data-middleware.js");
const PORT = Number(process.argv[2]) || 8092;

if (!hasData()) {
  console.error(`\n  No map data in ${ROOT}.\n  Build it first: python scripts/build_map_data.py (see app/README.md).\n`);
  process.exit(1);
}

const server = createServer((req, res) => {
  if (serveMapData(req, res)) return;
  res.writeHead(404);
  res.end("Map data is under /mapdata/");
});

// "::" listens on IPv6 and IPv4 alike.
server.listen(PORT, "::", () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find(a => a && a.family === "IPv4" && !a.internal)?.address;
  console.log(`\n  Map data, serving ${ROOT}\n`);
  console.log(`  This computer:  http://localhost:${PORT}/mapdata/manifest.json`);
  if (lan) console.log(`  Same network:   http://${lan}:${PORT}/mapdata/`);
  console.log(`\n  Ctrl+C to stop.\n`);
});
