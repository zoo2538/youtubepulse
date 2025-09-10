# youthbepulse.com 도메인 배포 가이드

## 🌐 도메인 정보
- **도메인**: youthbepulse.com
- **프로젝트**: YouTube Pulse Dashboard
- **기능**: 실시간 유튜브 트렌드 분석

## 🚀 배포 옵션

### **Option 1: Vercel 무료 배포 (추천)**
```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 프로젝트 배포
vercel

# 3. 도메인 연결
vercel domains add youthbepulse.com
```

### **Option 2: Netlify 무료 배포**
```bash
# 1. Netlify CLI 설치
npm i -g netlify-cli

# 2. 프로젝트 빌드
npm run build

# 3. 배포
netlify deploy --prod --dir=dist

# 4. 도메인 연결
netlify domains:add youthbepulse.com
```

### **Option 3: GitHub Pages 무료 배포**
```bash
# 1. GitHub에 코드 업로드
git add .
git commit -m "Deploy to youthbepulse.com"
git push origin main

# 2. GitHub Actions 자동 배포
# .github/workflows/deploy.yml 파일이 자동으로 실행됩니다
```

## ⚙️ 환경 변수 설정

### **필수 설정**
```bash
# .env 파일 생성
VITE_APP_URL=https://youthbepulse.com
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
VITE_CORS_ORIGIN=https://youthbepulse.com
```

### **YouTube API 키 발급**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. YouTube Data API v3 활성화
4. API 키 생성
5. 환경 변수에 추가

## 🔧 DNS 설정

### **Vercel 배포 시**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.19.61
```

### **Netlify 배포 시**
```
Type: CNAME
Name: www
Value: youthbepulse.netlify.app

Type: A
Name: @
Value: 75.2.60.5
```

## 📊 자동 데이터 수집 설정

### **GitHub Actions (무료)**
```yaml
# .github/workflows/daily-collection.yml
name: Daily YouTube Data Collection
on:
  schedule:
    - cron: '0 15 * * *'  # 매일 한국시간 자정
```

### **Vercel Cron Jobs**
```javascript
// api/collect-data.js
export default async function handler(req, res) {
  // 매일 자정에 자동 실행
  // YouTube 데이터 수집 로직
}
```

## 🎯 최종 추천

### **Vercel + GitHub Actions 조합**
1. ✅ **완전 무료** (0원)
2. ✅ **자동 배포** (Git 푸시 시)
3. ✅ **자동 데이터 수집** (매일 자정)
4. ✅ **글로벌 CDN** (빠른 로딩)
5. ✅ **SSL 자동 적용**

## 📝 배포 체크리스트

- [ ] YouTube API 키 발급 및 설정
- [ ] 환경 변수 설정 (.env 파일)
- [ ] Vercel/Netlify 계정 생성
- [ ] 도메인 DNS 설정
- [ ] 자동 배포 설정
- [ ] 자동 데이터 수집 설정
- [ ] SSL 인증서 확인
- [ ] 사이트 접속 테스트

## 🆘 문제 해결

### **도메인 연결 안됨**
- DNS 설정 확인 (24-48시간 소요)
- CNAME/A 레코드 정확성 확인

### **API 호출 실패**
- YouTube API 키 확인
- CORS 설정 확인
- 할당량 확인

### **자동 수집 안됨**
- GitHub Actions 활성화 확인
- 환경 변수 설정 확인
- 로그 확인

## 🎉 완료 후 확인사항

1. **사이트 접속**: https://youthbepulse.com
2. **데이터 수집**: 수동 실행 테스트
3. **자동 배포**: Git 푸시 후 자동 배포 확인
4. **자동 수집**: 다음날 자정 자동 실행 확인

**성공적으로 배포되면 youthbepulse.com에서 YouTube Pulse를 사용하실 수 있습니다!** 🚀






