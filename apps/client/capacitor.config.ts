import type { CapacitorConfig } from "@capacitor/cli";

// Core 0.1 -- mobile packaging foundation. `webDir` points at Vite's default
// build output; run `pnpm build` before `cap sync`/`cap run` so the native
// shells load the latest bundle. `ios`/`android` platform folders are added
// on demand via `npx cap add ios` / `npx cap add android` (not committed
// here -- they're generated, native-toolchain-specific projects).
const config: CapacitorConfig = {
  appId: "com.doomscrolls.client",
  appName: "Doomscrolls",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
