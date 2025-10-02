import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/' : './',
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    force: true,
    // SPA 라우팅을 위한 히스토리 API 폴백
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // React Router v7 Future Flag 설정
    __REACT_ROUTER_FUTURE_FLAGS__: JSON.stringify({
      v7_relativeSplatPath: true
    })
  },
}));