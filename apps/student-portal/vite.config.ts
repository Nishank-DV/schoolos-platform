import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4000";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["pwa-icon.svg"],
        manifest: {
          name: "SchoolOS Student Portal",
          short_name: "SchoolOS Student",
          description: "Student portal for assignments, insights, and CareerBuddy.",
          theme_color: "#0f172a",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          ],
        },
      }),
    ],
    server: { port: 3001, proxy: { "/api": { target: proxyTarget, changeOrigin: true } } },
  };
});
