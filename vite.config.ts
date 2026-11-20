import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { outDir: "dist" },
  server: { host: "127.0.0.1" },
  test: { include: ["tests/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
