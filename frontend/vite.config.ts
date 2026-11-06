import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forwarding API calls to the backend means development needs no CORS setup.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
