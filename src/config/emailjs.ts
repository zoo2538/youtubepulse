// EmailJS 설정
// 실제 사용 시 https://www.emailjs.com/ 에서 계정을 생성하고 다음 값들을 설정하세요

export const EMAILJS_CONFIG = {
  // EmailJS 서비스 ID (예: service_abc123)
  SERVICE_ID: 'service_youtube_pulse',
  
  // 이메일 템플릿 ID (예: template_xyz789)
  TEMPLATE_ID: 'template_password_reset',
  
  // Public Key (예: user_abc123def456)
  PUBLIC_KEY: 'your_public_key_here'
};

// 이메일 템플릿 예시:
/*
제목: YouTube Pulse 비밀번호 재설정

안녕하세요,

YouTube Pulse 계정의 비밀번호 재설정 요청을 받았습니다.

임시 비밀번호: {{temp_password}}

이 임시 비밀번호로 로그인한 후 새로운 비밀번호로 변경해주세요.

로그인 링크: {{reset_link}}

보안을 위해 이 임시 비밀번호는 24시간 후 만료됩니다.

감사합니다.
YouTube Pulse 팀
*/








