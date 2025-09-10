# YouTube Pulse 프로젝트 백업 정보

## 📅 백업 일시
- **날짜**: 2024년 8월 31일
- **시간**: 오후 11:32
- **백업 폴더**: `C:\YouTubePulse_Backup_2024-08-31_23-30`

## 🚀 프로젝트 상태

### 완료된 기능
- ✅ **React + TypeScript + Vite** 기반 프로젝트 설정
- ✅ **Electron 데스크톱 앱** 설정 완료
- ✅ **IndexedDB** 데이터베이스 구현
- ✅ **YouTube Data API** 연동
- ✅ **카테고리 분류 시스템** 구현
- ✅ **대시보드 UI** 구현
- ✅ **7일 데이터 보존 정책** 구현

### 주요 파일 구조
```
youtubepulse/
├── electron/                    # Electron 설정
│   ├── main.mjs               # 메인 프로세스
│   └── preload.mjs            # Preload 스크립트
├── src/
│   ├── components/            # UI 컴포넌트
│   ├── pages/                # 페이지 컴포넌트
│   │   ├── System.tsx        # 시스템 설정
│   │   ├── DataClassification.tsx # 데이터 분류
│   │   └── Dashboard.tsx     # 대시보드
│   ├── lib/
│   │   └── indexeddb-service.ts # IndexedDB 서비스
│   └── types/
│       └── electron.d.ts     # Electron 타입 정의
├── package.json              # 프로젝트 설정
└── vite.config.ts           # Vite 설정
```

### 카테고리 시스템
- **주요 카테고리**: 16개
- **자동 분류**: 같은 채널 영상 자동 분류
- **색상 시스템**: 각 카테고리별 고유 색상
- **세부 카테고리**: 쇼핑/리뷰 등 세부 분류

### 데이터 관리
- **IndexedDB**: 로컬 데이터베이스
- **7일 보존**: 자동 데이터 정리
- **백업 시스템**: 데이터 백업/복원 기능

## 🛠️ 기술 스택
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron
- **Database**: IndexedDB
- **API**: YouTube Data API v3
- **Build**: Vite, Electron Builder

## 📋 실행 방법
```bash
# 개발 모드 (데스크톱 앱)
npm run electron:dev

# 웹 개발 모드
npm run dev

# 프로덕션 빌드
npm run electron:dist
```

## 🔧 설정 정보
- **포트**: 8080 (Vite 개발 서버)
- **API 키**: YouTube Data API v3 필요
- **데이터 보존**: 7일
- **최소 창 크기**: 1200x800

## 📝 주의사항
- `node_modules` 폴더는 백업에서 제외됨
- `dist`, `dist-electron` 폴더는 백업에서 제외됨
- `.git` 폴더는 백업에서 제외됨

## 🔄 복원 방법
1. 백업 폴더의 내용을 새 프로젝트 폴더로 복사
2. `npm install` 실행하여 의존성 설치
3. `npm run electron:dev` 실행

---
**백업 생성자**: AI Assistant  
**프로젝트**: YouTube Pulse - 실시간 유튜브 트렌드 분석





