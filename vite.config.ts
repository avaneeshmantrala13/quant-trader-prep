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
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
