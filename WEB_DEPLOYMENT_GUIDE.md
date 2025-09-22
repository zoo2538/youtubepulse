# 🌐 YouTube Pulse 웹 배포 가이드

## 📋 개요
이 가이드는 YouTube Pulse 데스크탑 앱을 웹사이트로 배포하는 방법을 설명합니다.

## 🚀 배포 옵션

### 1. Netlify (추천)
- **장점**: 무료, 자동 배포, CDN, 커스텀 도메인 지원
- **비용**: 무료 플랜으로 충분
- **설정**: 이미 `netlify.toml` 파일 준비됨

### 2. Vercel
- **장점**: Next.js 최적화, 서버리스 함수
- **비용**: 무료 플랜 제공
- **설정**: 이미 `vercel.json` 파일 준비됨

### 3. GitHub Pages
- **장점**: 완전 무료, GitHub 연동
- **단점**: 정적 사이트만 지원

## 📝 단계별 배포 가이드

### Netlify 배포 (추천 방법)

#### 1단계: 코드 준비
```bash
# 현재 변경사항 커밋
git add .
git commit -m "웹 배포를 위한 설정 완료"
git push origin master
```

#### 2단계: Netlify 설정
1. [netlify.com](https://netlify.com) 접속
2. "New site from Git" 클릭
3. GitHub 저장소 선택
4. 빌드 설정:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `18`
5. "Deploy site" 클릭

#### 3단계: 환경 변수 설정
Netlify 대시보드 → Site settings → Environment variables에서 추가:
```
VITE_YOUTUBE_API_KEY=your_api_key
VITE_APP_URL=https://your-domain.com
VITE_APP_NAME=YouTube Pulse
NODE_ENV=production
```

#### 4단계: 커스텀 도메인 연결
1. Netlify 대시보드 → Site settings → Domain management
2. "Add custom domain" 클릭
3. 도메인 입력 (예: `youtubepulse.com`)
4. DNS 설정:
   ```
   Type: A
   Name: @
   Value: [Netlify에서 제공하는 IP]
   
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   ```

## 🔧 웹 환경 최적화

### PWA 설정
- Service Worker 자동 등록
- 오프라인 지원
- 앱 설치 가능

### 성능 최적화
- 코드 스플리팅
- 이미지 최적화
- CDN 활용

### SEO 최적화
- 메타 태그 설정
- 사이트맵 생성
- 구조화된 데이터

## 💰 비용 예상

### 무료 옵션
- **Netlify**: 무료 (100GB 대역폭/월)
- **Vercel**: 무료 (100GB 대역폭/월)
- **GitHub Pages**: 완전 무료

### 유료 옵션 (트래픽 증가시)
- **도메인**: 연간 10,000원 ~ 50,000원
- **Netlify Pro**: 월 $19
- **Vercel Pro**: 월 $20

## 🔒 보안 설정

### HTTPS
- 모든 배포 플랫폼에서 자동 제공
- SSL 인증서 자동 갱신

### 보안 헤더
- `netlify.toml`에 보안 헤더 설정됨
- XSS 보호, CSRF 보호 등

## 📊 모니터링 및 분석

### Google Analytics 설정
```javascript
// 환경 변수에 추가
VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
```

### 에러 모니터링
- Sentry 연동 가능
- Netlify Functions로 에러 로깅

## 🚀 자동 배포 설정

### GitHub Actions (선택사항)
```yaml
name: Deploy to Netlify
on:
  push:
    branches: [master]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './dist'
          production-branch: master
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
```

## 📱 모바일 최적화

### 반응형 디자인
- Tailwind CSS로 이미 구현됨
- 모바일 우선 설계

### 터치 최적화
- 터치 타겟 크기 최적화
- 스와이프 제스처 지원

## 🔄 업데이트 및 유지보수

### 자동 배포
- Git push 시 자동 배포
- 브랜치별 배포 환경 분리 가능

### 롤백
- Netlify에서 이전 버전으로 즉시 롤백 가능
- 배포 히스토리 관리

## 📞 지원 및 문제해결

### 일반적인 문제
1. **빌드 실패**: Node.js 버전 확인
2. **환경 변수**: Netlify 대시보드에서 설정 확인
3. **도메인 연결**: DNS 설정 확인

### 로그 확인
- Netlify 대시보드 → Functions → Logs
- 브라우저 개발자 도구 → Console

## 🎯 다음 단계

1. **도메인 구매**: 원하는 도메인명으로 구매
2. **Netlify 배포**: 위 가이드 따라 배포
3. **도메인 연결**: DNS 설정으로 커스텀 도메인 연결
4. **모니터링 설정**: Google Analytics 등 분석 도구 연동
5. **SEO 최적화**: 검색 엔진 최적화 작업

---

**참고**: 이 가이드는 현재 프로젝트 설정을 기반으로 작성되었습니다. 추가 설정이 필요한 경우 프로젝트 요구사항에 따라 조정하세요.
