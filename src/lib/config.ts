// Centralized configuration for API endpoints
// 하이브리드 모드: 서버 + IndexedDB
// 환경 변수 > 사용자 지정 > 기본값 순으로 결정
const ENV_API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || '';

let storedCustomApiUrl = '';
if (typeof window !== 'undefined') {
  try {
    storedCustomApiUrl = localStorage.getItem('customApiUrl') || '';
  } catch (error) {
    console.warn('⚠️ customApiUrl 로드 실패:', error);
  }
}

const DEFAULT_API_BASE_URL = 'https://api.youthbepulse.com';

export const API_BASE_URL = (storedCustomApiUrl || ENV_API_BASE || DEFAULT_API_BASE_URL).replace(/\/$/, '');
