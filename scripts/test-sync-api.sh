#!/bin/bash

# 증분 동기화 API 테스트 스크립트
# 서버→로컬 변경분 조회와 로컬→서버 업서트 테스트

API_BASE_URL="https://api.youthbepulse.com"
# 로컬 테스트용: API_BASE_URL="http://localhost:3000"

echo "🔄 증분 동기화 API 테스트 시작..."

# 1. 서버→로컬 변경분 조회
echo "📥 서버→로컬 변경분 조회 테스트..."
SINCE_TIMESTAMP=$(date -u +%FT%TZ)
echo "조회 시작 시간: $SINCE_TIMESTAMP"

DOWNLOAD_RESPONSE=$(curl -s "$API_BASE_URL/api/sync/download?since=$SINCE_TIMESTAMP")
echo "다운로드 응답: $DOWNLOAD_RESPONSE"

# 2. 로컬→서버 업서트 테스트
echo "📤 로컬→서버 업서트 테스트..."

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
    },
    {
      "videoId": "test-video-2", 
      "dayKeyLocal": "2025-10-05",
      "viewCount": 5678,
      "likeCount": 25,
      "channelName": "Test Channel 2",
      "videoTitle": "Test Video 2",
      "updatedAt": "2025-10-05T14:00:00+09:00"
    }
  ]
}
EOF

UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/sync/upload" \
  -H "Content-Type: application/json" \
  -d @/tmp/upload-changes.json)

echo "업로드 응답: $UPLOAD_RESPONSE"

# 3. 동기화 상태 확인
echo "📊 동기화 상태 확인..."
SYNC_CHECK_RESPONSE=$(curl -s "$API_BASE_URL/api/sync/check?since=$SINCE_TIMESTAMP")
echo "동기화 상태: $SYNC_CHECK_RESPONSE"

# 4. 헬스 체크
echo "🏥 API 헬스 체크..."
HEALTH_RESPONSE=$(curl -s "$API_BASE_URL/api/health")
echo "헬스 체크: $HEALTH_RESPONSE"

# 5. 정리
rm -f /tmp/upload-changes.json

echo "✅ 증분 동기화 API 테스트 완료"
