# YouTube Pulse Backend Server

데스크탑 앱과 동일한 기능을 제공하는 백엔드 API 서버입니다.

## 🚀 기능

- **YouTube API 연동**: 트렌딩 비디오 수집 및 검색
- **데이터 관리**: 비디오, 채널, 카테고리 데이터 저장/조회
- **인증 시스템**: JWT 기반 사용자 인증
- **대시보드 API**: 통계 및 차트 데이터 제공
- **시스템 관리**: 데이터 수집, 정리, 모니터링

## 📦 설치 및 실행

### 1. 의존성 설치
```bash
cd server
npm install
```

### 2. 환경 변수 설정
```bash
cp env.example .env
# .env 파일을 편집하여 실제 값으로 설정
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 프로덕션 서버 실행
```bash
npm start
```

## 🔧 API 엔드포인트

### 인증 (Auth)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/verify` - 토큰 검증
- `POST /api/auth/change-password` - 비밀번호 변경
- `GET /api/auth/profile` - 사용자 정보 조회

### YouTube API
- `POST /api/youtube/validate-key` - API 키 검증
- `POST /api/youtube/collect-trending` - 트렌딩 비디오 수집
- `POST /api/youtube/search-videos` - 키워드 기반 비디오 검색
- `POST /api/youtube/collect-bulk-data` - 대량 데이터 수집

### 데이터 관리
- `POST /api/data/save` - 데이터 저장
- `GET /api/data/load/:type` - 데이터 로드
- `GET /api/data/classified` - 분류된 데이터 조회
- `GET /api/data/unclassified` - 미분류 데이터 조회
- `PUT /api/data/classify` - 데이터 분류 업데이트

### 카테고리 관리
- `GET /api/categories` - 카테고리 목록 조회
- `POST /api/categories` - 카테고리 저장
- `POST /api/categories/:category/subcategories` - 세부카테고리 추가
- `DELETE /api/categories/:category/subcategories/:subCategory` - 세부카테고리 삭제

### 대시보드
- `GET /api/dashboard/overview` - 대시보드 개요
- `GET /api/dashboard/category-stats` - 카테고리별 통계
- `GET /api/dashboard/trending-videos` - 트렌딩 비디오
- `GET /api/dashboard/channel-trending` - 채널 트렌딩

### 시스템 관리
- `GET /api/system/info` - 시스템 정보
- `POST /api/system/test-database` - 데이터베이스 연결 테스트
- `POST /api/system/start-collection` - 데이터 수집 시작
- `GET /api/system/collection-status` - 수집 상태 조회

## 🗄️ 데이터 구조

### 비디오 데이터
```json
{
  "id": "video_id",
  "title": "비디오 제목",
  "description": "비디오 설명",
  "channelId": "채널 ID",
  "channelTitle": "채널명",
  "thumbnailUrl": "썸네일 URL",
  "publishedAt": "2024-01-01T00:00:00Z",
  "viewCount": 1000000,
  "likeCount": 50000,
  "commentCount": 1000,
  "duration": "PT10M30S",
  "category": "엔터테인먼트",
  "subCategory": "음악",
  "collectedAt": "2024-01-01T00:00:00Z"
}
```

### 카테고리 데이터
```json
{
  "엔터테인먼트": ["음악", "영화", "TV", "게임", "스포츠"],
  "교육": ["강의", "튜토리얼", "언어학습", "과학"],
  "라이프스타일": ["뷰티", "패션", "요리", "여행"]
}
```

## 🔒 보안

- **JWT 인증**: 토큰 기반 인증 시스템
- **Rate Limiting**: API 요청 제한
- **CORS**: Cross-Origin 요청 제어
- **Helmet**: 보안 헤더 설정
- **입력 검증**: 요청 데이터 유효성 검사

## 📊 모니터링

- **시스템 로그**: 자동 로그 수집 및 관리
- **성능 모니터링**: 메모리, CPU 사용량 추적
- **에러 추적**: 에러 로그 및 스택 트레이스
- **API 통계**: 요청 수, 응답 시간 통계

## 🚀 배포

### Docker 배포
```bash
docker build -t youtube-pulse-server .
docker run -p 3001:3001 youtube-pulse-server
```

### PM2 배포
```bash
npm install -g pm2
pm2 start server.js --name youtube-pulse-server
pm2 startup
pm2 save
```

## 🔧 개발

### 프로젝트 구조
```
server/
├── server.js              # 메인 서버 파일
├── routes/                # API 라우트
│   ├── auth.js           # 인증 관련
│   ├── data.js           # 데이터 관리
│   ├── categories.js     # 카테고리 관리
│   ├── dashboard.js      # 대시보드
│   ├── system.js         # 시스템 관리
│   └── youtube.js        # YouTube API
├── services/             # 비즈니스 로직
│   ├── auth-service.js   # 인증 서비스
│   ├── data-service.js   # 데이터 서비스
│   ├── category-service.js # 카테고리 서비스
│   ├── dashboard-service.js # 대시보드 서비스
│   ├── system-service.js # 시스템 서비스
│   └── youtube-api-service.js # YouTube API 서비스
├── package.json          # 의존성 관리
└── env.example          # 환경 변수 예시
```

### 주요 기술 스택

- **Node.js**: 서버 런타임
- **Express.js**: 웹 프레임워크
- **JWT**: 인증 토큰
- **bcryptjs**: 비밀번호 해시화
- **CORS**: Cross-Origin 요청 처리
- **Helmet**: 보안 미들웨어
- **Morgan**: 로깅 미들웨어

## 📝 라이선스

MIT License
