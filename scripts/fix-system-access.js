// 시스템 페이지 접근 문제 해결 스크립트
(function fixSystemAccess() {
  console.log('🔧 시스템 페이지 접근 문제 해결 중...');
  
  // 1. 현재 인증 상태 확인
  const currentEmail = localStorage.getItem('userEmail');
  const currentRole = localStorage.getItem('userRole');
  
  console.log('📊 현재 상태:');
  console.log('- 이메일:', currentEmail);
  console.log('- 역할:', currentRole);
  
  // 2. 관리자 권한 강제 설정
  localStorage.setItem('userEmail', 'ju9511503@gmail.com');
  localStorage.setItem('userRole', 'admin');
  
  console.log('✅ 관리자 권한 설정 완료');
  
  // 3. 시스템 페이지로 직접 이동
  console.log('🔄 시스템 페이지로 이동...');
  window.location.href = '/system';
})();
