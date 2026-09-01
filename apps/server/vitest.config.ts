import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Colyseus rooms run a real internal WebSocket server per test file
    // (see test/support/testRealtimeServer.ts); running test files in
    // parallel workers would fight over the same fixed test port.
    fileParallelism: false,
    // @colyseus/core peer-depends on @pm2/io, which auto-activates its
    // IPC transport whenever `process.send` exists -- true for vitest's
    // default forked-child-process pool. That collides with vitest's own
    // IPC protocol and crashes the worker. Worker threads have no
    // `process.send`, so @pm2/io stays dormant.
    pool: "threads",
  },
});
