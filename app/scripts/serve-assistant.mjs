// Standalone route-assistant backend, at http://localhost:8093/api/assistant.
//
// You don't need this to run the app: `npx expo start` serves the same endpoint (metro.config.js).
// Use it for a hosted demo, where the app is a static web build or a phone build: run this next to
// the key and point the app at it with EXPO_PUBLIC_ASSISTANT_URL=https://<host>/api/assistant.
// Served under a domain name, it also needs ASSISTANT_ALLOW_HOSTS=<host> (IP addresses and localhost
// are always accepted), and browsers on another origin need ASSISTANT_ALLOW_ORIGINS=https://<app origin>.
//
//   ANTHROPIC_API_KEY=... npm run assistant          # from app/
//   ANTHROPIC_API_KEY=... npm run assistant -- 8094  # different port
import { createServer } from "node:http";
import { createRequire } from "node:module";

const { serveAssistant, PATH } = createRequire(import.meta.url)("./assistant-middleware.js");
const PORT = Number(process.argv[2]) || 8093;

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn("\n  ANTHROPIC_API_KEY is not set: the endpoint will answer 503 and the app will use its scripted fallback.\n");
}

const server = createServer((req, res) => {
  if (serveAssistant(req, res)) return;
  res.writeHead(404);
  res.end(`The assistant is at ${PATH}`);
});
server.requestTimeout = 60_000;
server.headersTimeout = 10_000;

server.listen(PORT, "::", () => {
  console.log(`\n  Route assistant: http://localhost:${PORT}${PATH}\n  Ctrl+C to stop.\n`);
});
