import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgr({ include: "**/*.svg" })],
  server: {
    host: true,
    port: 5000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://0.0.0.0:5000",
        changeOrigin: true,
        secure: true,
        ws: true,
        onProxyReq: (proxyReq) => {
          proxyReq.setHeader("X-Forwarded-For", process.env.VITE_API_PROXY_TARGET || "http://0.0.0.0:5000"); // Add custom headers if needed
        },
      },
    },
  },
  optimizeDeps: {
    include: ["socket.io-client", "framer-motion"],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      external: [],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Bundle React and framer-motion together to prevent createContext errors
            if (id.includes("react") || id.includes("react-dom") || id.includes("framer-motion")) {
              return "vendor_react_core";
            }
            if (id.includes("react-router-dom")) {
              return "vendor_react_router";
            }
            if (id.includes("axios")) {
              return "vendor_axios";
            }
            if (id.includes("socket.io-client")) {
              return "vendor_socket_io_client";
            }
            if (id.includes("@tanstack/react-query")) {
              return "vendor_react_query";
            }
            // Group all other dependencies together to prevent fragmentation
            return "vendor_other";
          }
          // Keep SafePost and related components in the same chunk as React to ensure JSX access
          if (id.includes("SafePost") || id.includes("Post") || id.includes("InfinitePosts")) {
            return "vendor_react_core";
          }
          return undefined; // Let Vite handle the rest
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
