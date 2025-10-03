// 강제로 관리자 권한 설정하는 스크립트
(function forceAdmin() {
  console.log('🔧 강제 관리자 권한 설정...');
  
  // localStorage에 관리자 정보 저장
  localStorage.setItem('userEmail', 'ju9511503@gmail.com');
  localStorage.setItem('userRole', 'admin');
  
  console.log('✅ 관리자 권한 설정 완료:');
  console.log('- 이메일:', localStorage.getItem('userEmail'));
  console.log('- 역할:', localStorage.getItem('userRole'));
  
  // 페이지 새로고침
  console.log('🔄 페이지를 새로고침합니다...');
  window.location.reload();
})();
