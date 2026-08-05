/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // `amazon-cognito-identity-js` pulls in the `buffer` npm package, whose
  // module-init reads a bare `global.TYPED_ARRAY_SUPPORT` (no `typeof` guard).
  // In a browser bundle there is no `global`, so the Cognito SDK crashes with
  // "global is not defined" the moment the sign-up/login path loads it. Vite
  // does NOT shim Node globals, so we alias `global` → `globalThis` at build
  // time. This is the smallest fix that makes the Cognito flow run in-browser.
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the React runtime + router into their own long-lived vendor
        // chunk. These change far less often than app code, so isolating them
        // lets the browser cache them across app deploys. The per-route page
        // chunks are produced automatically by the React.lazy() imports in
        // App.tsx — Rollup emits one chunk per dynamic import.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Shared setup: stubs matchMedia + canvas-confetti and auto-cleans mounted
    // trees, so DOM tests don't each re-patch jsdom noise (see src/test/setup.ts).
    setupFiles: ["./src/test/setup.ts"],
  },
});
