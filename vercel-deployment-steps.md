# 🌐 Vercel 웹 배포 단계별 가이드

## 📋 배포 준비 완료
- ✅ 프로젝트 빌드 완료 (dist 폴더 생성됨)
- ✅ youthbepulse.com 도메인 설정 완료
- ✅ IndexedDB 전환 완료
- ✅ SEO 최적화 완료

## 🚀 Vercel 웹 배포 단계

### **1단계: Vercel 웹사이트 접속**
- 브라우저에서 **https://vercel.com** 접속
- 우측 상단 **"Sign Up"** 또는 **"Log In"** 클릭

### **2단계: GitHub 계정으로 로그인**
- **"Continue with GitHub"** 클릭
- GitHub 계정으로 로그인
- Vercel 권한 승인

### **3단계: 새 프로젝트 생성**
- 대시보드에서 **"Add New..."** 클릭
- **"Project"** 선택

### **4단계: 프로젝트 업로드**
**방법 A: GitHub 저장소 연결 (추천)**
- **"Import Git Repository"** 클릭
- GitHub 저장소 선택 또는 새로 생성
- **"Import"** 클릭

**방법 B: 직접 파일 업로드**
- **"Browse All Templates"** 클릭
- **"Other"** 선택
- **"Deploy"** 클릭
- `dist` 폴더 내용을 드래그 앤 드롭

### **5단계: 프로젝트 설정**
- **Project Name**: `youtube-pulse` (또는 원하는 이름)
- **Framework Preset**: `Vite` 선택
- **Root Directory**: `./` (기본값)
- **Build Command**: `npm run build` (기본값)
- **Output Directory**: `dist` (기본값)

### **6단계: 환경 변수 설정**
- **"Environment Variables"** 섹션에서 추가:
  ```
  VITE_APP_URL=https://youthbepulse.com
  VITE_CORS_ORIGIN=https://youthbepulse.com
  VITE_YOUTUBE_API_KEY=your_api_key_here
  ```

### **7단계: 배포 실행**
- **"Deploy"** 버튼 클릭
- 배포 진행 상황 확인 (약 2-3분 소요)

### **8단계: 도메인 연결**
- 배포 완료 후 **"Domains"** 탭 클릭
- **"Add Domain"** 클릭
- `youthbepulse.com` 입력
- **"Add"** 클릭

### **9단계: DNS 설정**
Vercel에서 제공하는 DNS 설정을 도메인 등록업체에 적용:

**A 레코드:**
```
Type: A
Name: @
Value: 76.76.19.61
```

**CNAME 레코드:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## ✅ 배포 완료 확인

### **테스트 사항:**
1. **임시 URL 접속**: `https://your-project.vercel.app`
2. **도메인 접속**: `https://youthbepulse.com` (DNS 설정 후)
3. **데이터 수집 테스트**: 수동 실행 버튼 클릭
4. **IndexedDB 확인**: 브라우저 개발자 도구에서 확인

### **자동화 설정:**
1. **GitHub Actions**: 코드 푸시 시 자동 배포
2. **자동 데이터 수집**: 매일 자정 실행
3. **7일 데이터 정리**: 자동 실행

## 🎉 완료!

성공적으로 배포되면:
- ✅ **https://youthbepulse.com** 접속 가능
- ✅ **무료 호스팅** (Vercel)
- ✅ **자동 배포** (Git 푸시 시)
- ✅ **자동 데이터 수집** (매일 자정)
- ✅ **IndexedDB 데이터 저장**
- ✅ **7일 자동 데이터 정리**

## 🆘 문제 해결

### **배포 실패 시:**
- 빌드 로그 확인
- 환경 변수 설정 확인
- GitHub 저장소 권한 확인

### **도메인 연결 안됨:**
- DNS 설정 확인 (24-48시간 소요)
- Vercel 도메인 설정 확인

### **API 호출 실패:**
- YouTube API 키 확인
- CORS 설정 확인

**이제 Vercel 웹사이트에서 배포를 시작하세요!** 🚀


