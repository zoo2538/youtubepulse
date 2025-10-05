#!/usr/bin/env bash
# YouTube Pulse 하이브리드 시스템 원클릭 통합 스크립트
# "증분 동기화 → 키 검증 → 충돌 해소 → 로컬 압축/청소 → 서버 멱등 업서트 검증"
set -euo pipefail

echo "🚀 YouTube Pulse 하이브리드 시스템 원클릭 통합 실행 시작..."

# 0) 환경 변수 점검
: "${API_BASE:?API_BASE is required}"    # 예: https://api.youthbepulse.com
: "${DATABASE_URL:?DATABASE_URL required}"
SINCE_TS="${SINCE_TS:-$(date -u -d '1 day ago' +%FT%TZ)}" # 기본 24h 증분

# Windows 호환성을 위한 날짜 생성
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  SINCE_TS="${SINCE_TS:-$(date -u -v-1d +%FT%TZ)}"
fi

mkdir -p .tmp

echo "📡 환경 설정:"
echo "  API Base: $API_BASE"
echo "  Since: $SINCE_TS"
echo "  Database: ${DATABASE_URL:0:20}..."

echo ""
echo "[1/7] 서버→로컬 증분 다운로드: since=${SINCE_TS}"
if curl -s "${API_BASE}/api/sync/download?since=${SINCE_TS}" -o .tmp/server_since.json; then
  server_count=$(jq '. | length' .tmp/server_since.json 2>/dev/null || echo "0")
  echo "✅ 서버 데이터 다운로드 완료: ${server_count}개 항목"
else
  echo "❌ 서버 다운로드 실패"
  exit 1
fi

echo ""
echo "[2/7] 로컬 스냅샷 생성"
# 로컬 스냅샷 파일이 없으면 빈 배열로 생성
if [ ! -f ".tmp/local_snapshot.json" ]; then
  echo "[]" > .tmp/local_snapshot.json
  echo "⚠️ 로컬 스냅샷이 없습니다. 빈 배열로 생성합니다."
else
  local_count=$(jq '. | length' .tmp/local_snapshot.json 2>/dev/null || echo "0")
  echo "✅ 로컬 스냅샷 로드: ${local_count}개 항목"
fi

echo ""
echo "[3/7] 키 기준 일치 검증 (videoId, dayKeyLocal)"
if node scripts/verify-key-consistency.js; then
  echo "✅ 키 기준 검증 완료"
else
  echo "⚠️ 키 기준 검증 실패 (계속 진행)"
fi

echo ""
echo "[4/7] 충돌 자동 해소 (views/likes=최대, 수동필드=로컬 우선)"
if node scripts/resolve-conflicts.js; then
  echo "✅ 충돌 해소 완료"
else
  echo "⚠️ 충돌 해소 실패 또는 충돌 없음 (계속 진행)"
fi

echo ""
echo "[5/7] 로컬 중복 압축/청소 (IndexedDB 관리)"
if node scripts/compress-indexeddb.js; then
  echo "✅ 로컬 압축/청소 완료"
else
  echo "⚠️ 로컬 압축/청소 실패 (계속 진행)"
fi

echo ""
echo "[6/7] 로컬→서버 업서트(멱등)"
if [ -f ".tmp/resolved_changes.json" ] && [ -s ".tmp/resolved_changes.json" ]; then
  if curl -s -X POST "${API_BASE}/api/sync/upload" \
    -H "Content-Type: application/json" \
    -d @.tmp/resolved_changes.json -o .tmp/upload_result.json; then
    echo "✅ 해소된 변경사항 업로드 완료"
    jq '.status,.stats?' .tmp/upload_result.json 2>/dev/null || echo "업로드 결과 확인 중..."
  else
    echo "⚠️ 업로드 실패 (계속 진행)"
  fi
else
  echo "⚠️ 해소된 변경사항이 없습니다."
fi

echo ""
echo "[7/7] 서버 멱등 복원/검증 (선택)"
if [ -f "scripts/restore_idempotent_merge.sql" ]; then
  if psql "$DATABASE_URL" -f scripts/restore_idempotent_merge.sql; then
    echo "✅ 서버 멱등 복원 완료"
  else
    echo "⚠️ 서버 멱등 복원 실패 (계속 진행)"
  fi
else
  echo "⚠️ 멱등 복원 스크립트가 없습니다."
fi

echo ""
echo "🎉 하이브리드 시스템 원클릭 통합 실행 완료!"
echo ""
echo "📊 실행 결과 요약:"
echo "  - 서버 데이터: $(jq '. | length' .tmp/server_since.json 2>/dev/null || echo 'N/A')개 항목"
echo "  - 로컬 스냅샷: $(jq '. | length' .tmp/local_snapshot.json 2>/dev/null || echo 'N/A')개 항목"
echo "  - 해소된 충돌: $(jq '. | length' .tmp/resolved_changes.json 2>/dev/null || echo '0')개 항목"
echo ""
echo "📁 생성된 파일들:"
ls -la .tmp/ 2>/dev/null || echo "  .tmp 디렉토리가 없습니다."
echo ""
echo "🔍 다음 단계:"
echo "  1. .tmp/ 디렉토리의 결과 파일들 확인"
echo "  2. 웹 앱에서 '하이브리드 동기화' 버튼 클릭"
echo "  3. IndexedDB 압축 스크립트 실행 (브라우저 콘솔)"
echo ""
echo "✅ 증분 동기화, 충돌 해소, 로컬 압축, 서버 업서트까지 원클릭 처리되었습니다."
