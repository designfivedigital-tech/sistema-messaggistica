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
        "favicon.svg",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
      ],

      manifest: {
        name: "Sistema Messaggistica",
        short_name: "Messaggi",
        description:
          "Sistema di messaggistica tra azienda e clienti.",

        theme_color: "#172033",
        background_color: "#f5f7fa",

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