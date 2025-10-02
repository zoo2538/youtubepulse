import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

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
    {
      name: 'generate-404',
      closeBundle() {
        const distPath = path.resolve(__dirname, 'dist');
        const indexHtml = path.join(distPath, 'index.html');
        const notFoundHtml = path.join(distPath, '404.html');

        // index.html에 redirect 보정 스크립트 삽입
        let html = fs.readFileSync(indexHtml, 'utf-8');
        if (!html.includes('sessionStorage.redirect')) {
          html = html.replace(
            '<head>',
            `<head>
<script>
  if (sessionStorage.redirect) {
    history.replaceState(null, null, sessionStorage.redirect);
    delete sessionStorage.redirect;
  }
</script>`
          );
          fs.writeFileSync(indexHtml, html, 'utf-8');
        }

        // 404.html 자동 생성 (GitHub Pages SPA 라우팅)
        const notFoundContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
  </head>
  <body>
    <script>
      sessionStorage.redirect = location.href;
      window.location.href = "/";
    </script>
  </body>
</html>`;
        fs.writeFileSync(notFoundHtml, notFoundContent, 'utf-8');
      },
    },
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