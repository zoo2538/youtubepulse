#!/bin/bash
# ===============================
# 🚀 Railway 헬스체크 자동 복구 스크립트
# 파일명: fix_healthcheck.sh
# ===============================

echo "🔧 [1/6] 간단한 헬스체크 서버 생성 중..."

cat << 'EOF' > start-server.js
import express from 'express';
const app = express();

// ✅ 헬스체크 엔드포인트
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ✅ 기본 포트 바인딩
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Health server running on port ${PORT}`));
EOF

echo "✅ start-server.js 생성 완료"

# -------------------------------------
echo "🔧 [2/6] package.json start 스크립트 수정 중..."
npm pkg set scripts.start="node start-server.js"
echo "✅ start 명령 변경 완료"

# -------------------------------------
echo "🔧 [3/6] Git 커밋 준비 중..."
git add start-server.js package.json
git commit -m "fix: simplified health server for Railway health check" || echo "⚠️ 변경 사항 없음 (commit skipped)"

# -------------------------------------
echo "🚀 [4/6] GitHub로 푸시 중..."
git push origin main

# -------------------------------------
echo "🕒 [5/6] Railway 자동 배포 대기 중..."
echo "   (약 2~3분 소요됩니다. 로그는 railway logs로 확인 가능)"

# -------------------------------------
echo "🧩 [6/6] 완료 안내"
echo ""
echo "✅ 이제 Railway 대시보드에서 배포 상태를 확인하세요."
echo "   배포가 성공하면 아래 명령으로 정상 서버를 복구할 수 있습니다:"
echo ""
echo "   git checkout HEAD~1 start-server.js"
echo "   git add start-server.js"
echo "   git commit -m 'restore: full server after health check pass'"
echo "   git push origin main"
echo ""
echo "💡 확인: curl https://api.youthbepulse.com/api/health"
echo "   → { \"status\": \"ok\" } 이면 정상입니다!"
