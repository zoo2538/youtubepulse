// 현재 인증 상태 확인 스크립트
(function checkAuthStatus() {
  console.log('🔍 현재 인증 상태 확인...');
  
  // localStorage에서 인증 정보 확인
  const storedEmail = localStorage.getItem('userEmail');
  const storedRole = localStorage.getItem('userRole');
  
  console.log('📊 저장된 인증 정보:');
  console.log('- 이메일:', storedEmail);
  console.log('- 역할:', storedRole);
  
  // 현재 도메인 정보
  console.log('🌐 현재 도메인:', window.location.hostname);
  console.log('🔧 개발 환경 여부:', window.location.hostname.includes('localhost'));
  
  // 관리자 여부 확인
  const isAdmin = storedRole === 'admin';
  const isCorrectEmail = storedEmail === 'ju9511503@gmail.com';
  
  console.log('👤 관리자 상태:');
  console.log('- 관리자 역할:', isAdmin);
  console.log('- 올바른 이메일:', isCorrectEmail);
  console.log('- 전체 관리자 여부:', isAdmin && isCorrectEmail);
  
  if (!isAdmin || !isCorrectEmail) {
    console.log('❌ 관리자 권한이 없습니다!');
    console.log('💡 해결 방법:');
    console.log('1. 로그아웃 후 다시 로그인');
    console.log('2. 이메일: ju9511503@gmail.com');
    console.log('3. 비밀번호: @ju9180417');
  } else {
    console.log('✅ 관리자 권한 확인됨!');
  }
})();
