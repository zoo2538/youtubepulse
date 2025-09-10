# YouTube Pulse - 실시간 유튜브 트렌드 분석

실시간 유튜브 트렌드 분석을 위한 데스크톱 애플리케이션입니다.

## 🚀 기능

- **실시간 데이터 수집**: YouTube Data API를 통한 실시간 데이터 수집
- **카테고리 분류**: 수동 및 자동 카테고리 분류 시스템
- **대시보드**: 실시간 트렌드 분석 대시보드
- **IndexedDB 저장**: 로컬 데이터베이스를 통한 안전한 데이터 저장
- **7일 데이터 보존**: 성능 최적화를 위한 7일 데이터 보존 정책

## 📦 설치 및 실행

### 개발 모드

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (브라우저)
npm run dev

# Electron 데스크톱 앱 실행 (개발 모드)
npm run electron:dev
```

### 프로덕션 빌드

```bash
# 웹 빌드
npm run build

# 데스크톱 앱 빌드
npm run electron:dist
```

## 🖥️ 데스크톱 앱

### 실행 파일 생성

```bash
# Windows 실행 파일 (.exe)
npm run electron:dist

# 생성된 파일 위치: dist-electron/
```

### 시스템 요구사항

- **Windows**: Windows 10 이상
- **macOS**: macOS 10.14 이상
- **Linux**: Ubuntu 18.04 이상

## 🔧 개발

### 프로젝트 구조

```
youtubepulse/
├── src/                    # React 소스 코드
│   ├── components/         # UI 컴포넌트
│   ├── pages/             # 페이지 컴포넌트
│   ├── lib/               # 유틸리티 및 서비스
│   └── types/             # TypeScript 타입 정의
├── electron/              # Electron 설정
│   ├── main.js           # 메인 프로세스
│   └── preload.js        # Preload 스크립트
├── public/               # 정적 파일
└── dist-electron/        # 빌드된 실행 파일
```

### 주요 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron
- **Database**: IndexedDB (로컬)
- **API**: YouTube Data API v3
- **Build**: Vite, Electron Builder

## 📊 데이터 관리

### IndexedDB 구조

- **unclassifiedData**: 미분류 데이터
- **classifiedData**: 분류 완료 데이터
- **channels**: 채널 정보
- **videos**: 비디오 데이터
- **categories**: 카테고리 정보
- **subCategories**: 세부 카테고리
- **systemConfig**: 시스템 설정

### 7일 데이터 보존 정책

- 오늘 기준 7일 데이터만 유지
- 자동 정리 기능
- 백업 후 삭제 옵션

## 🎨 카테고리 시스템

### 주요 카테고리

- 짜집기, 해외짜집기, 정치, AI
- 연예, 스포츠, 롱폼, 커뮤니티/썰
- 게임, 라이프스타일, 오피셜, 쇼핑/리뷰
- 기타, 언론, 키즈/육아, 해외채널

### 자동 분류

- 같은 채널의 영상 자동 분류
- 키워드 기반 자동 분류
- 수동 분류 지원

## 🔐 보안

- **IndexedDB**: 로컬 데이터베이스 사용
- **API 키**: 환경 변수로 관리
- **Electron**: 보안 설정 적용

## 📝 라이선스

MIT License

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
