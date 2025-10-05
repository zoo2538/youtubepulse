#!/bin/bash

# 하이브리드 시스템 설정 및 검증 스크립트
# Cursor Agent 터미널에서 순차 실행할 표준 명령 세트

echo "🚀 하이브리드 시스템 설정 시작..."

# 1) 서버 마이그레이션 적용
echo "📊 서버 마이그레이션 적용 중..."
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f scripts/migrations/20251005_video_day_unique.sql
    echo "✅ 서버 마이그레이션 완료"
else
    echo "⚠️  DATABASE_URL이 설정되지 않음. 로컬 PostgreSQL 연결 필요"
    echo "   DATABASE_URL=postgresql://user:password@localhost:5432/youtubepulse"
fi

# 2) 멱등 복원 스크립트 실행
echo "🔄 멱등 복원 스크립트 실행 중..."
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f scripts/restore_idempotent_merge.sql
    echo "✅ 멱등 복원 스크립트 완료"
else
    echo "⚠️  DATABASE_URL이 설정되지 않음. 스크립트만 생성됨"
fi

# 3) 증분 동기화 API 헬스 확인
echo "🌐 증분 동기화 API 헬스 확인 중..."
API_BASE_URL="https://api.youthbepulse.com"
# 로컬 테스트용: API_BASE_URL="http://localhost:3000"

SINCE_TIMESTAMP=$(date -u +%FT%TZ)
echo "조회 시작 시간: $SINCE_TIMESTAMP"

# 서버→로컬 변경분 조회 테스트
DOWNLOAD_RESPONSE=$(curl -s "$API_BASE_URL/api/sync/download?since=$SINCE_TIMESTAMP" || echo "API 연결 실패")
echo "📥 다운로드 응답: $DOWNLOAD_RESPONSE"

# 4) 로컬→서버 업서트 샘플 전송
echo "📤 로컬→서버 업서트 샘플 전송 중..."

# 테스트 데이터 생성
cat > /tmp/upload-changes.json << EOF
{
  "changes": [
    {
      "videoId": "test-video-1",
      "dayKeyLocal": "2025-10-05",
      "viewCount": 1234,
      "likeCount": 10,
      "channelName": "Test Channel",
      "videoTitle": "Test Video",
      "updatedAt": "2025-10-05T13:00:00+09:00"
    }
  ]
}
EOF

UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/sync/upload" \
  -H "Content-Type: application/json" \
  -d @/tmp/upload-changes.json || echo "API 연결 실패")
echo "📤 업로드 응답: $UPLOAD_RESPONSE"

# 5) API 헬스 체크
echo "🏥 API 헬스 체크 중..."
HEALTH_RESPONSE=$(curl -s "$API_BASE_URL/api/health" || echo "API 연결 실패")
echo "🏥 헬스 체크: $HEALTH_RESPONSE"

# 6) 정리
rm -f /tmp/upload-changes.json

# 7) IndexedDB 마이그레이션 스크립트 실행
echo "💾 IndexedDB 마이그레이션 스크립트 실행 중..."
if command -v node &> /dev/null; then
    node scripts/indexeddb-migration-snippet.js
    echo "✅ IndexedDB 마이그레이션 완료"
else
    echo "⚠️  Node.js가 설치되지 않음. IndexedDB 마이그레이션 스킵"
fi

# 8) 최종 상태 확인
echo "📊 최종 상태 확인 중..."
echo "✅ 하이브리드 시스템 설정 완료"
echo ""
echo "📋 설정된 기능들:"
echo "   - 유니크 제약: (video_id, day_key_local)"
echo "   - 멱등 복원: 임시 테이블 머지"
echo "   - 증분 동기화: since 기반 다운로드"
echo "   - 양방향 동기화: 멱등 업서트"
echo "   - IndexedDB: 복합 키 + Math.max 병합"
echo ""
echo "🎯 다음 단계:"
echo "   1. 웹 애플리케이션에서 하이브리드 동기화 테스트"
echo "   2. 백업/복원 기능으로 멱등성 검증"
echo "   3. 자동/수동 수집 데이터 병합 테스트"
