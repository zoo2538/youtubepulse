import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

// src/server/api 디렉토리를 dist/server/src/server/api로 복사
const srcServerApiDir = path.join(__dirname, '..', 'src', 'server', 'api');
const distServerApiDir = path.join(serverDir, 'src', 'server', 'api');

if (fs.existsSync(srcServerApiDir)) {
  copyDir(srcServerApiDir, distServerApiDir);
  console.log('✅ 서버 API 디렉토리 복사 완료:', distServerApiDir);
} else {
  console.warn('⚠️ src/server/api 디렉토리를 찾을 수 없습니다:', srcServerApiDir);
}

// src/lib 디렉토리를 dist/server/src/lib로 복사 (postgresql-service-server.js, gemini-service.ts 등)
const srcLibDir = path.join(__dirname, '..', 'src', 'lib');
const distServerLibDir = path.join(serverDir, 'src', 'lib');

if (fs.existsSync(srcLibDir)) {
  copyDir(srcLibDir, distServerLibDir);
  console.log('✅ 서버 lib 디렉토리 복사 완료:', distServerLibDir);
  
  // TypeScript 파일을 JavaScript로 컴파일 (gemini-service.ts 등)
  const geminiServiceTs = path.join(distServerLibDir, 'gemini-service.ts');
  const geminiServiceJs = path.join(distServerLibDir, 'gemini-service.js');
  
  if (fs.existsSync(geminiServiceTs)) {
    try {
      console.log('🔨 gemini-service.ts를 JavaScript로 컴파일 중...');
      execSync(`npx tsc ${geminiServiceTs} --outDir ${distServerLibDir} --module esnext --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck --declaration false`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ gemini-service.js 컴파일 완료');
    } catch (error) {
      console.warn('⚠️ gemini-service.ts 컴파일 실패, .ts 파일을 그대로 사용합니다:', error.message);
    }
  }
} else {
  console.warn('⚠️ src/lib 디렉토리를 찾을 수 없습니다:', srcLibDir);
}