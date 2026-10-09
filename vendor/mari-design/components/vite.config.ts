import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Serves and builds the component-library preview (.preview). `npm run dev`
// runs the hot-reload server; `npm run build` emits a static site to
// components/dist, which the deploy workflow publishes to design.mari.guru.
export default defineConfig({
  root: ".preview",
  base: "/",
  plugins: [react()],
  // Opening a browser is OPT-IN, and only `npm run dev` opts in (MARI_OPEN=1).
  // It used to be opt-out, which meant any ad-hoc script that spawned a dev
  // server without setting MARI_NO_OPEN threw a stray Chrome window at
  // whoever was using the machine. QA tooling must never do that, so the
  // default has to be the safe one.
  server: { open: !!process.env.MARI_OPEN },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, ".preview/index.html"),
        pages: resolve(__dirname, ".preview/pages.html"),
        canvas: resolve(__dirname, ".preview/canvas.html"),
        render: resolve(__dirname, ".preview/render.html"),
        states: resolve(__dirname, ".preview/states.html"),
      },
    },
  },
});
