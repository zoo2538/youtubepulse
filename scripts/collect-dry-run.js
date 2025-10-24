// 드라이런 자동수집 스크립트 (DB 없이 조회만)
import dotenv from 'dotenv';
import { autoCollectData } from '../server.js';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

console.log('🚀 드라이런 자동수집 시작...');
console.log('📊 DRY_RUN 모드: 저장 없이 조회만 수행');

// DRY_RUN 플래그 설정
process.env.DRY_RUN = 'true';

try {
  // 자동수집 함수 실행 (저장 단계는 건너뜀)
  await autoCollectData();
  console.log('✅ 드라이런 자동수집 완료!');
} catch (error) {
  console.error('❌ 드라이런 자동수집 실패:', error);
  process.exit(1);
}
