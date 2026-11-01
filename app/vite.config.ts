import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import qrcode from "qrcode-terminal";

/** After the dev server starts, print a QR code of its Wi-Fi address so a phone can open it by scanning. */
function phoneQr(): Plugin {
  const print = (server: ViteDevServer) => {
    const url = server.resolvedUrls?.network[0];
    if (!url) {
      server.config.logger.warn("  No Wi-Fi address found, so no phone QR code. Is this computer on a network?");
      return;
    }
    qrcode.generate(url, { small: true }, qr => {
      server.config.logger.info(`\n  Scan with your phone camera (same Wi-Fi as this computer):\n\n${qr}\n  ${url}\n`);
    });
  };
  return {
    name: "phone-qr",
    configureServer(server) {
      server.httpServer?.once("listening", () => setTimeout(() => print(server), 50));
    },
    configurePreviewServer(server) {
      server.httpServer.once("listening", () => setTimeout(() => print(server as unknown as ViteDevServer), 50));
    },
  };
}

export default defineConfig({
  plugins: [react(), phoneQr()],
  // Listen on the local network too, so phones on the same Wi-Fi can connect.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
