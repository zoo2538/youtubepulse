import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/category-migration'

// 애니/웹툰 마이그레이션 스크립트를 전역에서 사용할 수 있도록 임포트
import { migrateAnimeWebtoonData } from './lib/anime-webtoon-migration';
// 롱폼 → 시니어 마이그레이션 스크립트를 전역에서 사용할 수 있도록 임포트
import { migrateLongformToSenior } from './lib/senior-migration';

// 전역 객체에 마이그레이션 함수 추가 (개발자 도구에서 사용 가능)
(window as any).migrateAnimeWebtoonData = migrateAnimeWebtoonData;
(window as any).migrateLongformToSenior = migrateLongformToSenior;

// 자동 마이그레이션: 분류 데이터 키(classifiedData -> youtubepulse_classified_data)
try {
  const legacy = localStorage.getItem('classifiedData')
  const current = localStorage.getItem('youtubepulse_classified_data')
  if (legacy && (!current || current === '[]')) {
    localStorage.setItem('youtubepulse_classified_data', legacy)
  }
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

// PWA Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

