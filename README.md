# YouTube Pulse

YouTube 데이터 수집 및 분석 도구 - 데스크탑 앱 및 웹 버전

## 🚀 주요 기능

- **YouTube 데이터 수집**: 64개 키워드로 트렌딩 영상 자동 수집
- **카테고리 분류**: 16개 카테고리로 영상 자동 분류
- **실시간 대시보드**: 수집된 데이터의 실시간 분석 및 시각화
- **데이터 관리**: 14일 데이터 보존 정책으로 효율적인 저장소 관리
- **사용자 관리**: 관리자/일반 사용자 권한 시스템

## 🛠️ 기술 스택

### Frontend
- **React 18** + **TypeScript**
- **Vite** (빌드 도구)
- **Tailwind CSS** (스타일링)
- **Electron** (데스크탑 앱)

### Backend
- **Node.js** + **Express**
- **PostgreSQL** (데이터베이스)
- **Redis** (캐싱)
- **YouTube Data API v3**

### 배포
- **Netlify** (웹 호스팅)
- **Railway** (백엔드 호스팅)

## 📦 설치 및 실행

### 데스크탑 앱 실행
```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run electron:dev

# 프로덕션 빌드
npm run electron:dist
```

### 웹 버전 실행
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

### 백엔드 서버 실행
```bash
cd server
npm install
npm start
```

## 🔧 환경 설정

### 1. 환경 변수 설정
`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# YouTube API
VITE_YOUTUBE_API_KEY=your_youtube_api_key

# 앱 설정
VITE_APP_URL=http://localhost:8080
VITE_CORS_ORIGIN=http://localhost:3000

# Supabase (선택사항)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. YouTube API 키 발급
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. YouTube Data API v3 활성화
4. API 키 생성 및 제한 설정

## 📊 데이터 수집 키워드

총 **64개 키워드**로 수집:
- 인기콘텐츠 (4개)
- 엔터테인먼트 (3개)
- 게임 (2개)
- 라이프스타일 (3개)
- 여행라이프 (3개)
- 교육 (3개)
- 투자경제 (4개)
- 뉴스이슈 (4개)
- 음악예술 (2개)
- 영화드라마 (4개)
- 기술개발 (3개)
- 스포츠 (3개)
- 쇼핑리뷰 (4개)
- 창작취미 (3개)
- 애니웹툰 (3개)
- 시니어 (9개)
- 트렌드밈 (5개)

## 🗂️ 프로젝트 구조

```
youtube-pulse/
├── src/                    # React 소스 코드
│   ├── components/         # 재사용 가능한 컴포넌트
│   ├── pages/             # 페이지 컴포넌트
│   ├── lib/               # 유틸리티 및 서비스
│   └── contexts/          # React Context
├── server/                # 백엔드 서버
│   ├── routes/            # API 라우트
│   └── services/          # 비즈니스 로직
├── electron/              # Electron 메인 프로세스
├── public/                # 정적 파일
└── dist/                  # 빌드 결과물
```

## 🔄 데이터 보존 정책

- **보존 기간**: 14일
- **자동 정리**: 14일 이상 된 데이터 자동 삭제
- **저장소**: IndexedDB (데스크탑) / PostgreSQL (웹)

## 👥 사용자 권한

- **관리자**: 모든 기능 접근 가능, 사용자 관리
- **일반 사용자**: 데이터 조회 및 분류 기능

## 🚀 배포

### 웹 배포 (Netlify)
1. GitHub 저장소 연결
2. 빌드 명령어: `npm run build`
3. 배포 디렉토리: `dist`

### 백엔드 배포 (Railway)
1. GitHub 저장소 연결
2. 루트 디렉토리: `server`
3. 빌드 명령어: `npm install`
4. 시작 명령어: `npm start`

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해 주세요.

---

**YouTube Pulse** - YouTube 데이터의 모든 것을 한눈에! 📊✨