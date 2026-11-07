import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        // `admin-guard` is a plain module beside the admin routes, not a route
        // file, so the generator must skip it.
        routeFileIgnorePattern: "\\.test\\.|^admin-guard\\.ts$",
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 3000,
    proxy: {
      "/api": process.env.IRIS_API_ORIGIN ?? "http://localhost:3001",
    },
  },
});
