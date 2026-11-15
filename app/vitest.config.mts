// Unit and HTTP tests: `npm test`. React Native and Expo are replaced by small stubs, so only plain
// logic (routing, search, panoramas, the offline assistant) and the dev-server middleware run here;
// the UI is checked by hand in the iOS Simulator and the browser.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "react-native": here("./tests/stubs/react-native.ts"),
      "expo-constants": here("./tests/stubs/expo-constants.ts"),
    },
  },
});
