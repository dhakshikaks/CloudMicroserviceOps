import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        // Mirrors production Nginx's routing for `npm run dev` outside Docker,
        // so the default relative VITE_API_BASE_URL/VITE_PROMETHEUS_URL work here too.
        proxy: {
            "/api": { target: "http://localhost:8080", changeOrigin: true },
            "/prometheus": {
                target: "http://localhost:9090",
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/prometheus/, ""); },
            },
        },
    },
});
