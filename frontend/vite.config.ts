import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ethereum: ["ethers"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
