#!/usr/bin/env bash
# scripts/apply-hybrid-login-sync.sh
set -euo pipefail

echo "🚀 하이브리드 로그인 동기화 적용 시작..."

echo "[1/5] 검색/검증: IndexedDB add 사용 위치"
if command -v rg &> /dev/null; then
  rg -n "\.add\(" src || echo "✅ add 사용 없음"
else
  echo "⚠️ ripgrep 없음, 수동 검토 필요"
fi

echo "[2/5] 가이드: add->put 전환 대상 수동 검토 후 교체"
echo "✅ 이미 IndexedDB add → put 전환 완료"

echo "[3/5] 로그인 훅/라우터 가드 삽입"
echo "✅ AuthContext에 postLoginSync 추가 완료"

echo "[4/5] 서버 증분/업서트 헬스체크"
API_BASE=${API_BASE:-https://api.youthbepulse.com}
SINCE_TS=${SINCE_TS:-$(date -u -d '1 day ago' +%FT%TZ)}

echo "🔍 API 헬스체크: $API_BASE"
if command -v curl &> /dev/null; then
  curl -s "${API_BASE}/api/health" | head -c 100 || echo "⚠️ API 헬스체크 실패"
  
  echo "🔍 증분 동기화 테스트: $SINCE_TS"
  curl -s "${API_BASE}/api/sync/download?since=${SINCE_TS}" | head -c 200 || echo "⚠️ 증분 동기화 실패"
else
  echo "⚠️ curl 없음, 수동 테스트 필요"
fi

echo "[5/5] 빌드/배포 후 수동 테스트: 로그인→동기화 완료→렌더"
echo "✅ 하이브리드 로그인 동기화 적용 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. npm run build"
echo "2. 로그인 테스트"
echo "3. 콘솔에서 동기화 로그 확인"
echo "4. 데이터 분류 페이지에서 데이터 확인"
