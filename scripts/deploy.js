#!/usr/bin/env node

/**
 * YouTube Pulse 배포 스크립트 (Windows 호환)
 * GitHub Pages와 Railway 배포를 자동화합니다.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`🔍 ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

// 명령어 실행 헬퍼
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'inherit',
      ...options 
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 환경 변수 확인
function checkEnvironment() {
  logSection('환경 변수 확인');
  
  const githubToken = process.env.GITHUB_TOKEN;
  const railwayToken = process.env.RAILWAY_TOKEN;
  
  if (!githubToken) {
    logWarning('GITHUB_TOKEN이 설정되지 않았습니다.');
    logInfo('GitHub Pages 배포는 건너뜁니다.');
    return { skipGitHub: true, skipRailway: !railwayToken };
  } else {
    logSuccess('GITHUB_TOKEN 확인됨');
  }
  
  if (!railwayToken) {
    logWarning('RAILWAY_TOKEN이 설정되지 않았습니다.');
    logInfo('Railway 배포는 건너뜁니다.');
    return { skipGitHub: false, skipRailway: true };
  } else {
    logSuccess('RAILWAY_TOKEN 확인됨');
    return { skipGitHub: false, skipRailway: false };
  }
}

// 코드 품질 검사
function runQualityChecks() {
  logSection('코드 품질 검사');
  
  logInfo('ESLint 실행 중...');
  const lintResult = runCommand('npm run lint');
  if (lintResult.success) {
    logSuccess('ESLint 통과');
  } else {
    logError('ESLint 실패');
    process.exit(1);
  }
  
  logInfo('TypeScript 타입 체크 중...');
  const typeCheckResult = runCommand('npm run type-check');
  if (typeCheckResult.success) {
    logSuccess('TypeScript 타입 체크 통과');
  } else {
    logError('TypeScript 타입 체크 실패');
    process.exit(1);
  }
}

// 프론트엔드 빌드
function buildFrontend() {
  logSection('프론트엔드 빌드');
  
  logInfo('의존성 설치 중...');
  const installResult = runCommand('npm install');
  if (!installResult.success) {
    logError('의존성 설치 실패');
    process.exit(1);
  }
  
  logInfo('프로덕션 빌드 중...');
  const buildResult = runCommand('npm run build');
  if (!buildResult.success) {
    logError('프론트엔드 빌드 실패');
    process.exit(1);
  }
  
  // 빌드 결과 확인
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    logSuccess('프론트엔드 빌드 완료');
    
    logInfo('빌드 결과 확인:');
    const indexHtml = fs.existsSync(path.join(distPath, 'index.html'));
    const notFoundHtml = fs.existsSync(path.join(distPath, '404.html'));
    const assetsDir = fs.existsSync(path.join(distPath, 'assets'));
    
    log(`${indexHtml ? '✅' : '❌'} index.html`, indexHtml ? 'green' : 'red');
    log(`${notFoundHtml ? '✅' : '❌'} 404.html`, notFoundHtml ? 'green' : 'red');
    log(`${assetsDir ? '✅' : '❌'} assets 폴더`, assetsDir ? 'green' : 'red');
    
    // assets 폴더의 파일 수 확인
    if (assetsDir) {
      const assetsPath = path.join(distPath, 'assets');
      const files = fs.readdirSync(assetsPath, { recursive: true });
      const fileCount = files.filter(file => fs.statSync(path.join(assetsPath, file)).isFile()).length;
      logInfo(`assets 파일 수: ${fileCount}개`);
    }
  } else {
    logError('빌드 실패: dist 폴더가 생성되지 않음');
    process.exit(1);
  }
}

// GitHub Pages 배포
function deployToGitHubPages() {
  logSection('GitHub Pages 배포');
  
  // Git 상태 확인
  const gitStatus = runCommand('git status --porcelain', { encoding: 'utf8' });
  if (gitStatus.success && gitStatus.output.trim() === '') {
    logInfo('커밋할 변경사항이 없습니다.');
  } else {
    logInfo('변경사항 커밋 중...');
    const addResult = runCommand('git add .');
    if (!addResult.success) {
      logError('Git add 실패');
      process.exit(1);
    }
    
    const commitMessage = `feat: deploy ${new Date().toISOString().replace('T', ' ').split('.')[0]}`;
    const commitResult = runCommand(`git commit -m "${commitMessage}"`);
    if (!commitResult.success) {
      logError('Git commit 실패');
      process.exit(1);
    }
    logSuccess('커밋 완료');
  }
  
  // GitHub Pages에 배포
  logInfo('GitHub Pages에 배포 중...');
  
  // gh-pages 패키지 확인 및 설치
  const ghPagesCheck = runCommand('npm list gh-pages', { encoding: 'utf8' });
  if (!ghPagesCheck.success) {
    logInfo('gh-pages 패키지 설치 중...');
    const installGhPages = runCommand('npm install --save-dev gh-pages');
    if (!installGhPages.success) {
      logError('gh-pages 패키지 설치 실패');
      process.exit(1);
    }
  }
  
  // GitHub Pages 배포
  const deployResult = runCommand('npm run deploy');
  if (deployResult.success) {
    logSuccess('GitHub Pages 배포 완료');
    
    const deployedUrl = 'https://zoo2538.github.io/youtubepulse/';
    logInfo(`배포된 URL: ${deployedUrl}`);
    
    // 캐시 무효화를 위한 쿼리 파라미터 추가 URL
    const cacheBustUrl = `${deployedUrl}?v=${Date.now()}`;
    logInfo(`캐시 무효화 URL: ${cacheBustUrl}`);
    
    return deployedUrl;
  } else {
    logError('GitHub Pages 배포 실패');
    process.exit(1);
  }
}

// Railway 배포
async function deployToRailway() {
  logSection('Railway 배포');
  
  // Railway CLI 설치 확인
  const railwayCheck = runCommand('railway --version', { encoding: 'utf8' });
  if (!railwayCheck.success) {
    logInfo('Railway CLI 설치 중...');
    const installRailway = runCommand('npm install -g @railway/cli');
    if (!installRailway.success) {
      logError('Railway CLI 설치 실패');
      process.exit(1);
    }
  }
  
  // Railway 로그인 확인
  const whoamiResult = runCommand('railway whoami', { encoding: 'utf8' });
  if (!whoamiResult.success) {
    logInfo('Railway에 로그인 중...');
    const authResult = runCommand(`echo ${process.env.RAILWAY_TOKEN} | railway auth`);
    if (!authResult.success) {
      logError('Railway 로그인 실패');
      process.exit(1);
    }
  }
  
  // Railway 배포
  logInfo('Railway에 배포 중...');
  const distServerPath = path.join(__dirname, '..', 'dist', 'server');
  
  // dist/server 디렉토리로 이동하여 배포
  process.chdir(distServerPath);
  
  const deployResult = runCommand('railway deploy --service youtubepulse-backend');
  if (deployResult.success) {
    logSuccess('Railway 배포 완료');
    
    // 배포된 서비스 URL 확인
    const domainResult = runCommand('railway domain', { encoding: 'utf8' });
    let serviceUrl = null;
    if (domainResult.success) {
      serviceUrl = domainResult.output.trim();
      logInfo(`배포된 서비스 URL: ${serviceUrl}`);
    }
    
    // 헬스 체크 실행
    if (serviceUrl) {
      logInfo('헬스 체크 실행 중...');
      try {
        const healthResponse = await fetch(`${serviceUrl}/health/db`);
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData.status === 'UP') {
            logSuccess('헬스 체크 통과');
          } else {
            logWarning('헬스 체크 실패: 서버가 아직 준비되지 않음');
          }
        } else {
          logWarning('헬스 체크 실패: 서버 응답 오류');
        }
      } catch (error) {
        logWarning(`헬스 체크 실패: ${error.message}`);
      }
    }
    
    return serviceUrl;
  } else {
    logError('Railway 배포 실패');
    process.exit(1);
  }
}

// 배포 후 검증
async function verifyDeployment(githubUrl, railwayUrl) {
  logSection('배포 검증');
  
  // GitHub Pages 검증
  if (githubUrl) {
    logInfo('GitHub Pages 검증 중...');
    try {
      const response = await fetch(githubUrl);
      if (response.ok) {
        logSuccess('GitHub Pages 접근 가능');
      } else {
        logWarning(`GitHub Pages 접근 실패: HTTP ${response.status}`);
      }
    } catch (error) {
      logWarning(`GitHub Pages 검증 실패: ${error.message}`);
    }
  }
  
  // Railway 검증
  if (railwayUrl) {
    logInfo('Railway API 서버 검증 중...');
    try {
      const response = await fetch(`${railwayUrl}/health/db`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'UP') {
          logSuccess('Railway API 서버 접근 가능');
        } else {
          logWarning('Railway API 서버 상태 불량');
        }
      } else {
        logWarning(`Railway API 서버 접근 실패: HTTP ${response.status}`);
      }
    } catch (error) {
      logWarning(`Railway 검증 실패: ${error.message}`);
    }
  }
}

// 전체 배포 과정 실행
async function main() {
  logSection('YouTube Pulse 배포 시작');
  logInfo(`시작 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  
  // 1. 환경 변수 확인
  const { skipGitHub, skipRailway } = checkEnvironment();
  
  // 2. 코드 품질 검사
  runQualityChecks();
  
  // 3. 프론트엔드 빌드
  buildFrontend();
  
  // 4. GitHub Pages 배포
  let githubUrl = null;
  if (!skipGitHub) {
    githubUrl = deployToGitHubPages();
  } else {
    logWarning('GitHub Pages 배포 건너뜀');
  }
  
  // 5. Railway 배포
  let railwayUrl = null;
  if (!skipRailway) {
    railwayUrl = await deployToRailway();
  } else {
    logWarning('Railway 배포 건너뜀');
  }
  
  // 6. 배포 검증
  await verifyDeployment(githubUrl, railwayUrl);
  
  // 완료 메시지
  logSection('배포 완료');
  logSuccess('모든 배포 작업이 완료되었습니다!');
  logInfo(`완료 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  
  if (githubUrl) {
    logInfo(`🌐 프론트엔드: ${githubUrl}`);
  }
  
  if (railwayUrl) {
    logInfo(`🚂 백엔드 API: ${railwayUrl}`);
  }
  
  log('\n🎉 배포 성공! 서버 우선 하이브리드 시스템이 활성화되었습니다.', 'green');
}

// 스크립트 실행
main().catch(error => {
  logError(`배포 실행 실패: ${error.message}`);
  process.exit(1);
});
