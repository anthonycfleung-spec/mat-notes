import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from /mat-notes/; dev stays at the root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/mat-notes/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Mat Notes",
        short_name: "Mat Notes",
        description: "Set an intention, train, reflect.",
        theme_color: "#0e0f12",
        background_color: "#0e0f12",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,woff2,png,svg}"] },
    }),
  ],
  test: { environment: "node" },
}));
