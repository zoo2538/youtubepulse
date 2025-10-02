import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist/server 디렉토리 생성
const serverDir = path.join(__dirname, '..', 'dist', 'server');
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

// server.js를 dist/server/index.js로 복사
const sourceFile = path.join(__dirname, '..', 'server.js');
const targetFile = path.join(serverDir, 'index.js');

fs.copyFileSync(sourceFile, targetFile);
console.log('✅ 서버 파일 복사 완료:', targetFile);
