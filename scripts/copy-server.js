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

// src/server/api 디렉토리를 dist/server/src/server/api로 복사
const srcServerApiDir = path.join(__dirname, '..', 'src', 'server', 'api');
const distServerApiDir = path.join(serverDir, 'src', 'server', 'api');

if (fs.existsSync(srcServerApiDir)) {
  // 디렉토리 재귀적으로 복사하는 함수
  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  copyDir(srcServerApiDir, distServerApiDir);
  console.log('✅ 서버 API 디렉토리 복사 완료:', distServerApiDir);
} else {
  console.warn('⚠️ src/server/api 디렉토리를 찾을 수 없습니다:', srcServerApiDir);
}