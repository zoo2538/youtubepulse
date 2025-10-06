import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig({
  // 커스텀 도메인 배포 (루트 경로)
  base: "/",
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    force: true,
    // SPA 라우팅을 위한 히스토리 API 폴백
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'https://api.youthbepulse.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 핵심 모듈들을 안정적인 청크로 분리
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['lucide-react'],
          'utils': ['@/lib/utils', '@/lib/date-rollover-service'],
          'services': ['@/lib/hybrid-service', '@/lib/indexeddb-service', '@/lib/api-service'],
          'auto-classification': ['@/lib/auto-classification-service'],
          'scheduler': ['@/lib/auto-collection-scheduler', '@/lib/server-authoritative-service']
        },
      },
    },
    // 청크 크기 경고 제한 증가
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    {
      name: 'generate-404',
      writeBundle() {
        const distPath = path.resolve(__dirname, 'dist');
        const indexHtml = path.join(distPath, 'index.html');
        const notFoundHtml = path.join(distPath, '404.html');

        // index.html 파일 존재 확인
        if (!fs.existsSync(indexHtml)) {
          console.warn('⚠️ index.html 파일이 아직 생성되지 않았습니다. 404.html만 생성합니다.');
          // 404.html만 생성
          const notFoundContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
  </head>
  <body>
    <script>
      // GitHub Pages SPA 라우팅을 위한 404.html 리다이렉트
      console.log('🔄 404.html에서 SPA 리다이렉트 시작');
      console.log('📍 현재 URL:', location.href);
      
      // 리다이렉트 루프 방지
      if (sessionStorage.getItem('redirecting')) {
        console.log('⚠️ 리다이렉트 루프 감지, 중단');
        sessionStorage.removeItem('redirecting');
        return;
      }
      
      // 리다이렉트 플래그 설정
      sessionStorage.setItem('redirecting', 'true');
      
      // 현재 URL을 sessionStorage에 저장하고 메인 페이지로 리다이렉트
      sessionStorage.redirect = location.href;
      console.log('💾 리다이렉트 URL 저장:', location.href);
      
      // 루트 경로로 리다이렉트 (커스텀 도메인용)
      window.location.href = "/";
    </script>
  </body>
</html>`;
          fs.writeFileSync(notFoundHtml, notFoundContent, 'utf-8');
          return;
        }

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
      // GitHub Pages SPA 라우팅을 위한 404.html 리다이렉트
      console.log('🔄 404.html에서 SPA 리다이렉트 시작');
      console.log('📍 현재 URL:', location.href);
      
      // 현재 URL을 sessionStorage에 저장하고 메인 페이지로 리다이렉트
      sessionStorage.redirect = location.href;
      console.log('💾 리다이렉트 URL 저장:', location.href);
      
      // 루트 경로로 리다이렉트 (커스텀 도메인용)
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
});