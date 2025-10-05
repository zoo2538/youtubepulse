#!/usr/bin/env bash
# 하이브리드 동기화 및 정리 통합 스크립트

set -euo pipefail

echo "🚀 하이브리드 동기화 및 정리 시작..."

# 환경변수 확인
if [ -z "${API_BASE:-}" ]; then
    export API_BASE="https://api.youthbepulse.com"
fi

if [ -z "${SINCE_TS:-}" ]; then
    export SINCE_TS=$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%S.%3NZ' 2>/dev/null || date -u -v-24H '+%Y-%m-%dT%H:%M:%S.%3NZ' 2>/dev/null || date -u -d '1 day ago' '+%Y-%m-%dT%H:%M:%S.%3NZ')
fi

echo "📡 API Base: $API_BASE"
echo "⏰ Since: $SINCE_TS"

# 1단계: 서버→로컬 증분 다운로드
echo ""
echo "[1/6] 서버→로컬 증분 다운로드..."
if curl -s "${API_BASE}/api/sync/download?since=${SINCE_TS}" -o .tmp/server_since.json; then
    echo "✅ 서버 데이터 다운로드 완료"
else
    echo "❌ 서버 데이터 다운로드 실패"
    exit 1
fi

# 2단계: 로컬→서버 업로드
echo ""
echo "[2/6] 로컬→서버 업로드..."
if [ -f ".tmp/local_changes.json" ]; then
    if curl -s -X POST "${API_BASE}/api/sync/upload" \
        -H "Content-Type: application/json" \
        -d @.tmp/local_changes.json -o .tmp/upload_result.json; then
        echo "✅ 로컬 변경사항 업로드 완료"
    else
        echo "⚠️ 로컬 변경사항 업로드 실패 (계속 진행)"
    fi
else
    echo "⚠️ 로컬 변경사항 파일이 없습니다. 빈 배열로 업로드합니다."
    echo "[]" > .tmp/local_changes.json
    if curl -s -X POST "${API_BASE}/api/sync/upload" \
        -H "Content-Type: application/json" \
        -d @.tmp/local_changes.json -o .tmp/upload_result.json; then
        echo "✅ 빈 변경사항 업로드 완료"
    else
        echo "⚠️ 빈 변경사항 업로드 실패 (계속 진행)"
    fi
fi

# 3단계: 키 기준 일치 검증
echo ""
echo "[3/6] 키 기준 일치 검증..."
if node scripts/verify-key-consistency.js; then
    echo "✅ 키 기준 검증 완료"
else
    echo "❌ 키 기준 검증 실패"
    exit 1
fi

# 4단계: 충돌 해소
echo ""
echo "[4/6] 충돌 해소..."
if node scripts/resolve-conflicts.js; then
    echo "✅ 충돌 해소 완료"
else
    echo "⚠️ 충돌 해소 실패 또는 충돌 없음 (계속 진행)"
fi

# 5단계: 해소된 변경사항 재업로드
echo ""
echo "[5/6] 해소된 변경사항 재업로드..."
if [ -f ".tmp/resolved_changes.json" ] && [ -s ".tmp/resolved_changes.json" ]; then
    if curl -s -X POST "${API_BASE}/api/sync/upload" \
        -H "Content-Type: application/json" \
        -d @.tmp/resolved_changes.json -o .tmp/upload_resolved.json; then
        echo "✅ 해소된 변경사항 재업로드 완료"
    else
        echo "⚠️ 해소된 변경사항 재업로드 실패 (계속 진행)"
    fi
else
    echo "⚠️ 해소된 변경사항이 없습니다."
fi

# 6단계: 서버 멱등 복원 (선택적)
echo ""
echo "[6/6] 서버 멱등 복원 (선택적)..."
if node scripts/run-idempotent-restore.js; then
    echo "✅ 서버 멱등 복원 완료"
else
    echo "⚠️ 서버 멱등 복원 실패 또는 건너뜀 (계속 진행)"
fi

echo ""
echo "🎉 하이브리드 동기화 및 정리 완료!"
echo ""
echo "📊 결과 요약:"
echo "  - 서버 데이터: $(cat .tmp/server_since.json | jq '. | length' 2>/dev/null || echo 'N/A')개 항목"
echo "  - 로컬 변경사항: $(cat .tmp/local_changes.json | jq '. | length' 2>/dev/null || echo 'N/A')개 항목"
echo "  - 해소된 충돌: $(cat .tmp/resolved_changes.json | jq '. | length' 2>/dev/null || echo '0')개 항목"
echo ""
echo "📁 생성된 파일들:"
ls -la .tmp/ 2>/dev/null || echo "  .tmp 디렉토리가 없습니다."
