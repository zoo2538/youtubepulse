# 📧 EmailJS 설정 가이드

YouTube Pulse 앱에서 실제 이메일 발송을 위해 EmailJS를 설정하는 방법입니다.

## 🚀 1단계: EmailJS 계정 생성

1. [EmailJS 웹사이트](https://www.emailjs.com/) 방문
2. 무료 계정 생성 (월 200통까지 무료)
3. 이메일 인증 완료

## ⚙️ 2단계: 이메일 서비스 설정

### Gmail 설정 (추천)
1. EmailJS 대시보드 → **Email Services** 클릭
2. **Add New Service** 클릭
3. **Gmail** 선택
4. Gmail 계정으로 로그인
5. 서비스 ID 복사 (예: `service_abc123`)

### 다른 이메일 서비스
- Outlook, Yahoo, 기타 SMTP 서비스도 지원

## 📝 3단계: 이메일 템플릿 생성

1. **Email Templates** → **Create New Template** 클릭
2. 템플릿 설정:

### 템플릿 내용
```
제목: YouTube Pulse 비밀번호 재설정

안녕하세요,

YouTube Pulse 계정의 비밀번호 재설정 요청을 받았습니다.

임시 비밀번호: {{temp_password}}

이 임시 비밀번호로 로그인한 후 새로운 비밀번호로 변경해주세요.

로그인 링크: {{reset_link}}

보안을 위해 이 임시 비밀번호는 24시간 후 만료됩니다.

감사합니다.
YouTube Pulse 팀
```

3. 템플릿 ID 복사 (예: `template_xyz789`)

## 🔑 4단계: Public Key 확인

1. **Account** → **General** 클릭
2. Public Key 복사 (예: `user_abc123def456`)

## 🔧 5단계: 코드 설정

`src/config/emailjs.ts` 파일을 수정:

```typescript
export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_abc123',        // 2단계에서 복사한 값
  TEMPLATE_ID: 'template_xyz789',      // 3단계에서 복사한 값  
  PUBLIC_KEY: 'user_abc123def456'      // 4단계에서 복사한 값
};
```

## ✅ 6단계: 테스트

1. 앱을 다시 시작
2. 비밀번호 찾기 페이지에서 이메일 입력
3. 실제 이메일이 발송되는지 확인

## 🛡️ 보안 고려사항

- ✅ **Public Key는 클라이언트에 노출되어도 안전** (EmailJS 특성)
- ✅ **이메일 템플릿에서 변수명 주의** (`{{temp_password}}`, `{{reset_link}}`)
- ✅ **스팸 필터링** 고려하여 이메일 내용 작성

## 🚨 문제 해결

### 이메일이 발송되지 않는 경우
1. 서비스 ID, 템플릿 ID, Public Key 확인
2. 이메일 서비스 연결 상태 확인
3. 스팸 폴더 확인
4. 브라우저 콘솔에서 오류 메시지 확인

### 개발 모드 메시지가 나오는 경우
- `src/config/emailjs.ts`의 설정값이 기본값으로 되어있음
- 실제 EmailJS 값으로 변경 필요

## 💰 비용

- **무료**: 월 200통까지
- **유료**: 월 1,000통부터 $15/월

---

**설정 완료 후 실제 이메일 발송이 시작됩니다!** 🎉








