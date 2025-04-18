import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "./assets",
  build: {
    outDir: "../static/js",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // main: "./js/main.js",
        "home-animation": resolve(__dirname, "./assets/js/home-animation.js"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash].[ext]",
      },
    },
  },
});
