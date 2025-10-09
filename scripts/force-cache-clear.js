#!/usr/bin/env node

/**
 * 강제 캐시 클리어 스크립트
 * 브라우저 캐시 문제 해결을 위한 도구
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧹 강제 캐시 클리어 스크립트 시작...');

// 1. 캐시 클리어 HTML 파일을 dist에 복사
const sourceFile = path.join(__dirname, '..', 'public', 'clear-cache.html');
const distFile = path.join(__dirname, '..', 'dist', 'clear-cache.html');

try {
    if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, distFile);
        console.log('✅ 캐시 클리어 도구가 dist에 복사되었습니다');
    } else {
        console.log('⚠️ clear-cache.html 파일을 찾을 수 없습니다');
    }
} catch (error) {
    console.error('❌ 파일 복사 실패:', error.message);
}

// 2. 버전 정보 파일 생성 (캐시 무효화용)
const versionInfo = {
    timestamp: new Date().toISOString(),
    buildId: Math.random().toString(36).substr(2, 9),
    version: '1.0.0'
};

const versionFile = path.join(__dirname, '..', 'dist', 'version.json');

try {
    fs.writeFileSync(versionFile, JSON.stringify(versionInfo, null, 2));
    console.log('✅ 버전 정보 파일 생성:', versionInfo.buildId);
} catch (error) {
    console.error('❌ 버전 파일 생성 실패:', error.message);
}

// 3. 캐시 무효화를 위한 meta 태그 업데이트
const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
    try {
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // 캐시 무효화 meta 태그 추가
        const cacheBusterMeta = `
    <!-- Cache Buster -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <meta name="build-id" content="${versionInfo.buildId}">`;
        
        // head 태그 안에 추가
        html = html.replace('</head>', cacheBusterMeta + '\n  </head>');
        
        fs.writeFileSync(indexPath, html);
        console.log('✅ index.html에 캐시 무효화 메타 태그 추가');
    } catch (error) {
        console.error('❌ index.html 업데이트 실패:', error.message);
    }
}

console.log('🎉 강제 캐시 클리어 설정 완료!');
console.log('📍 사용법:');
console.log('   1. https://zoo2538.github.io/youtubepulse/clear-cache.html 접속');
console.log('   2. "전체 캐시 클리어" 버튼 클릭');
console.log('   3. "메인 페이지로 이동" 버튼 클릭');
console.log('   4. 강제 새로고침 (Ctrl+Shift+R)');
