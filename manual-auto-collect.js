// 수동 자동수집 실행 스크립트
import { autoCollectData } from './server.js';

console.log('🚀 수동 자동수집 시작...');

try {
  await autoCollectData();
  console.log('✅ 수동 자동수집 완료!');
} catch (error) {
  console.error('❌ 수동 자동수집 실패:', error);
  process.exit(1);
}
