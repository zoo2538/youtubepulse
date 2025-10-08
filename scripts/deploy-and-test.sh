#!/bin/bash

# YouTube Pulse 자동수집 문제 해결 배포 및 테스트 스크립트

echo "🚀 YouTube Pulse 자동수집 문제 해결 시작"
echo "=============================================="

# 1단계: ENV 진단
echo "1️⃣ ENV 진단 중..."
node scripts/check-env.js

if [ $? -ne 0 ]; then
    echo "❌ ENV 진단 실패"
    exit 1
fi

echo "✅ ENV 진단 완료"

# 2단계: 로컬 서버 테스트
echo ""
echo "2️⃣ 로컬 서버 테스트 중..."

# 기존 서버 중지 (포트 3000 사용 중인 경우)
echo "🔍 포트 3000 사용 중인 프로세스 확인..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  포트 3000 사용 중 - 기존 프로세스 종료"
    lsof -ti:3000 | xargs kill -9
    sleep 2
fi

# 새 서버 시작
echo "🚀 새 서버 시작 중..."
node server-new.js &
SERVER_PID=$!

# 서버 시작 대기
echo "⏳ 서버 시작 대기 중..."
sleep 10

# 3단계: 헬스체크
echo ""
echo "3️⃣ 헬스체크 실행 중..."

echo "🔍 기본 헬스체크..."
curl -f http://localhost:3000/health || {
    echo "❌ 기본 헬스체크 실패"
    kill $SERVER_PID
    exit 1
}

echo "🔍 DB 헬스체크..."
curl -f http://localhost:3000/health/db || {
    echo "❌ DB 헬스체크 실패"
    kill $SERVER_PID
    exit 1
}

echo "🔍 전체 헬스체크..."
curl -f http://localhost:3000/health/full || {
    echo "❌ 전체 헬스체크 실패"
    kill $SERVER_PID
    exit 1
}

echo "✅ 모든 헬스체크 통과"

# 4단계: 자동수집 테스트
echo ""
echo "4️⃣ 자동수집 테스트 중..."

echo "🤖 자동수집 API 호출..."
AUTO_COLLECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auto-collect \
    -H "Content-Type: application/json" \
    -d '{"dateKey": "'$(date +%Y-%m-%d)'"}')

echo "📊 자동수집 응답: $AUTO_COLLECT_RESPONSE"

# JSON 응답 파싱 및 성공 여부 확인
if echo "$AUTO_COLLECT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ 자동수집 성공"
    
    # 저장된 데이터 확인
    echo "🔍 저장된 데이터 확인..."
    curl -s http://localhost:3000/api/auto-collected | jq '.data | length' | xargs -I {} echo "📊 저장된 데이터: {}개"
else
    echo "❌ 자동수집 실패"
    echo "📝 오류 상세: $AUTO_COLLECT_RESPONSE"
fi

# 5단계: 서버 정리
echo ""
echo "5️⃣ 서버 정리 중..."
kill $SERVER_PID
sleep 2

echo ""
echo "✅ 로컬 테스트 완료"
echo "=============================================="

# 6단계: 배포 준비
echo ""
echo "6️⃣ 배포 준비 중..."

# 기존 서버 백업
if [ -f "server.js" ]; then
    echo "📦 기존 서버 백업 중..."
    cp server.js server-backup-$(date +%Y%m%d-%H%M%S).js
fi

# 새 서버로 교체
echo "🔄 서버 파일 교체 중..."
mv server.js server-old.js
mv server-new.js server.js

# package.json 업데이트 (필요시)
echo "📝 package.json 확인 중..."
if ! grep -q "node-cron" package.json; then
    echo "📦 필요한 패키지 설치 중..."
    npm install node-cron
fi

echo ""
echo "🎉 배포 준비 완료!"
echo ""
echo "다음 단계:"
echo "1. git add ."
echo "2. git commit -m 'fix: resolve auto-collection PostgreSQL connection issues'"
echo "3. git push origin main"
echo ""
echo "Railway 배포 후:"
echo "1. Railway 대시보드에서 로그 확인"
echo "2. /health/db 엔드포인트 테스트"
echo "3. 자동수집 수동 실행 및 결과 확인"
