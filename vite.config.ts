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
        // 파일명 해싱으로 캐시 무효화 보장
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
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
      (function() {
        // spa-github-pages 방식: 원경로를 ?p= 파라미터로 인코딩하여 안전하게 전달
        console.log('🔄 404.html에서 SPA 리다이렉트 시작');
        console.log('📍 현재 URL:', location.href);
        
        // /assets/* 경로는 절대 가로채지 않음
        if (location.pathname.startsWith('/assets/')) {
          console.log('⚠️ 자산 파일 요청 - 404.html에서 처리하지 않음');
          return;
        }
        
        // 원경로를 ?p= 파라미터로 인코딩하여 전달
        const pathSegmentsToKeep = 0; // 커스텀 도메인 루트용
        const pathSegments = location.pathname.split('/').slice(1);
        const segmentsToKeep = pathSegments.slice(0, pathSegmentsToKeep);
        const pathToRestore = '/' + segmentsToKeep.join('/') + location.search + location.hash;
        
        console.log('💾 복원할 경로:', pathToRestore);
        
        // 인코딩된 경로로 리다이렉트 (루프 방지)
        window.location.replace(location.origin + '/?p=' + encodeURIComponent(pathToRestore));
      })();
    </script>
  </body>
</html>`;
          fs.writeFileSync(notFoundHtml, notFoundContent, 'utf-8');
          return;
        }

        // index.html에 SPA 라우팅 복원 스크립트 삽입
        let html = fs.readFileSync(indexHtml, 'utf-8');
        if (!html.includes('spa-restored')) {
          html = html.replace(
            '<head>',
            `<head>
    <!-- SPA 라우팅 복원 스크립트 (1회만 실행) -->
    <script>
      (function() {
        // 이미 복원이 실행되었는지 확인
        if (sessionStorage.getItem('spa-restored')) {
          return;
        }
        
        // ?p= 파라미터 감지 및 복원
        const urlParams = new URLSearchParams(location.search);
        const pathToRestore = urlParams.get('p');
        
        if (pathToRestore) {
          console.log('🔄 SPA 라우팅 복원:', pathToRestore);
          
          // history.replaceState로 원경로 복원 (페이지 새로고침 없음)
          history.replaceState(null, null, pathToRestore);
          
          // 복원 완료 플래그 설정 (중복 실행 방지)
          sessionStorage.setItem('spa-restored', 'true');
          
          console.log('✅ SPA 라우팅 복원 완료');
        }
      })();
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
      (function() {
        // spa-github-pages 방식: 원경로를 ?p= 파라미터로 인코딩하여 안전하게 전달
        console.log('🔄 404.html에서 SPA 리다이렉트 시작');
        console.log('📍 현재 URL:', location.href);
        
        // /assets/* 경로는 절대 가로채지 않음
        if (location.pathname.startsWith('/assets/')) {
          console.log('⚠️ 자산 파일 요청 - 404.html에서 처리하지 않음');
          return;
        }
        
        // 원경로를 ?p= 파라미터로 인코딩하여 전달
        const pathSegmentsToKeep = 0; // 커스텀 도메인 루트용
        const pathSegments = location.pathname.split('/').slice(1);
        const segmentsToKeep = pathSegments.slice(0, pathSegmentsToKeep);
        const pathToRestore = '/' + segmentsToKeep.join('/') + location.search + location.hash;
        
        console.log('💾 복원할 경로:', pathToRestore);
        
        // 인코딩된 경로로 리다이렉트 (루프 방지)
        window.location.replace(location.origin + '/?p=' + encodeURIComponent(pathToRestore));
      })();
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