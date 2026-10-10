import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 48765,
    strictPort: true,
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
