// 하이브리드 동기화 환경 설정
import fs from 'fs';
import path from 'path';

const config = {
  // API 설정
  API_BASE: process.env.API_BASE || 'https://api.youthbepulse.com',
  
  // 데이터베이스 설정
  DATABASE_URL: process.env.DATABASE_URL,
  
  // 임시 디렉토리
  EXPORT_DIR: '.tmp',
  
  // 동기화 기준 시점 (24시간 전)
  SINCE_TS: process.env.SINCE_TS || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  
  // 백업 디렉토리
  BACKUP_DIR: 'backups'
};

[config.EXPORT_DIR, config.BACKUP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 디렉토리 생성: ${dir}`);
  }
});

export default config;
