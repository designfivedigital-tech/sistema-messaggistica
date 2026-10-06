import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      strategies: "injectManifest",

      srcDir: "src",
      filename: "sw.ts",

      registerType: "autoUpdate",

      injectRegister: false,

      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "notification-badge.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
      ],

      manifest: {
        name: "Assistenza Five Digital",
        short_name: "Five Digital",
        description:
          "Assistenza clienti Five Digital.",

        theme_color: "#e20074",
        background_color: "#e20074",

        display: "standalone",
        orientation: "portrait-primary",

        scope: "/",
        start_url: "/",

        lang: "it",
        dir: "ltr",

        categories: [
          "business",
          "communication",
          "productivity",
        ],

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      injectManifest: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,woff2}",
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});