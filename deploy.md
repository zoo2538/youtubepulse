# YouTube Pulse 도메인 연결 가이드

## 🚀 배포 옵션

### 1. Vercel 배포 (추천)
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 배포
vercel

# 도메인 연결
vercel domains add yourdomain.com
```

### 2. Netlify 배포
```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 프로젝트 빌드
npm run build

# 배포
netlify deploy --prod --dir=dist

# 도메인 연결
netlify domains:add yourdomain.com
```

### 3. GitHub Pages 배포
```bash
# GitHub Actions 워크플로우 사용
# .github/workflows/deploy.yml 파일이 자동으로 생성됩니다
```

## 🔧 환경 변수 설정

1. `env.example` 파일을 `.env`로 복사
2. 다음 값들을 실제 값으로 변경:
   - `VITE_YOUTUBE_API_KEY`: YouTube Data API 키
   - `VITE_APP_URL`: 실제 도메인 URL
   - `VITE_CORS_ORIGIN`: 허용할 도메인

## 📝 도메인 연결 단계

### Vercel에서 도메인 연결
1. Vercel 대시보드 → 프로젝트 선택
2. Settings → Domains
3. "Add Domain" 클릭
4. 구입한 도메인 입력
5. DNS 설정 안내에 따라 도메인 등록업체에서 설정

### Netlify에서 도메인 연결
1. Netlify 대시보드 → 프로젝트 선택
2. Domain management → Add custom domain
3. 구입한 도메인 입력
4. DNS 설정 안내에 따라 설정

## 🔒 SSL 인증서
- Vercel/Netlify에서 자동으로 Let's Encrypt SSL 인증서 발급
- HTTPS 자동 적용

## 📊 성능 최적화
- 이미지 최적화: WebP 형식 사용
- 코드 분할: Vite의 자동 코드 분할 활용
- 캐싱: 정적 자산에 대한 적절한 캐시 헤더 설정

## 🛠️ 문제 해결

### CORS 오류
```javascript
// vite.config.ts에서 CORS 설정
server: {
  cors: true,
  origin: ['https://yourdomain.com']
}
```

### 라우팅 오류 (SPA)
- 모든 경로를 `index.html`로 리다이렉트 설정 필요
- `vercel.json` 또는 `netlify.toml`에서 설정됨

### 환경 변수 문제
- `VITE_` 접두사가 붙은 변수만 클라이언트에서 접근 가능
- 서버 사이드 변수는 별도 설정 필요


