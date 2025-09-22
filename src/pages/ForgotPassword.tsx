import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle, ArrowRight, Copy } from "lucide-react";
import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '@/config/emailjs';

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  // EmailJS 초기화
  const EMAILJS_SERVICE_ID = EMAILJS_CONFIG.SERVICE_ID;
  const EMAILJS_TEMPLATE_ID = EMAILJS_CONFIG.TEMPLATE_ID;
  const EMAILJS_PUBLIC_KEY = EMAILJS_CONFIG.PUBLIC_KEY;

  // 이메일 발송 함수
  const sendPasswordResetEmail = async (userEmail: string, tempPassword: string) => {
    try {
      // EmailJS 설정이 제대로 되어있는지 확인
      if (EMAILJS_PUBLIC_KEY === 'your_public_key_here') {
        console.warn('⚠️ EmailJS가 설정되지 않았습니다. 개발 모드로 실행됩니다.');
        // 개발 모드에서는 시뮬레이션만 수행
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        console.log('📧 개발 모드: 이메일 발송 시뮬레이션 완료');
        return true;
      }

      const templateParams = {
        to_email: userEmail,
        temp_password: tempPassword,
        app_name: 'YouTube Pulse',
        reset_link: `${window.location.origin}/login`
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      
      console.log('✅ 이메일 발송 성공:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ 이메일 발송 실패:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    // 실제 비밀번호 재설정 로직
    try {
      // 로컬 스토리지에서 사용자 데이터 확인
      const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const defaultAdmin = {
        id: "admin-1",
        email: "ju9511503@gmail.com",
        password: "@ju9180417"
      };
      
      const allUsers = [defaultAdmin, ...storedUsers];
      const user = allUsers.find(u => u.email === email);
      
      if (!user) {
        setError("해당 이메일로 등록된 계정을 찾을 수 없습니다.");
        setIsLoading(false);
        return;
      }
      
      // 비밀번호 재설정 (임시 비밀번호 생성)
      const tempPassword = Math.random().toString(36).slice(-8); // 8자리 임시 비밀번호
      console.log('🔑 생성된 임시 비밀번호:', tempPassword);
      
      // 사용자 데이터 업데이트
      const updatedUsers = storedUsers.map((u: any) => 
        u.email === email ? { ...u, password: tempPassword } : u
      );
      
      // 이메일 발송 시도
      const emailSentSuccessfully = await sendPasswordResetEmail(email, tempPassword);
      
      if (emailSentSuccessfully) {
        // 이메일 발송 성공
        setEmailSent(true);
        
        // 기본 관리자 계정은 별도 처리 (하드코딩된 비밀번호를 임시로 변경)
        if (email === "ju9511503@gmail.com") {
          // 기본 관리자 계정의 임시 비밀번호를 localStorage에 저장
          const adminTempPassword = { tempPassword: tempPassword, timestamp: Date.now() };
          localStorage.setItem('adminTempPassword', JSON.stringify(adminTempPassword));
          console.log('👑 관리자 임시 비밀번호 저장:', tempPassword);
        } else {
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          console.log('👤 일반 사용자 비밀번호 업데이트:', tempPassword);
        }
        
        setIsLoading(false);
        setSuccess(true);
      } else {
        // 이메일 발송 실패
        setError("이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        setIsLoading(false);
      }
      
      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate("/login");
      }, 3000);
      
    } catch (error) {
      console.error('비밀번호 재설정 오류:', error);
      setError("비밀번호 재설정 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                <h2 className="text-2xl font-bold text-white">이메일을 확인하세요</h2>
                <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4">
                  <Mail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-white font-semibold mb-2">비밀번호 재설정 이메일 발송 완료</p>
                  <p className="text-gray-300">
                    <strong className="text-white">{email}</strong>로<br />
                    임시 비밀번호를 보내드렸습니다.
                  </p>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ <strong>보안 안내:</strong> 임시 비밀번호로 로그인한 후<br />
                    반드시 새로운 비밀번호로 변경해주세요.
                  </p>
                </div>
                <p className="text-gray-300 text-sm">
                  📧 이메일이 오지 않는다면 스팸 폴더를 확인해주세요.<br />
                  ⏰ 임시 비밀번호는 <strong className="text-white">1시간</strong> 후 만료됩니다.
                </p>
                <div className="pt-4 space-y-2">
                  <Button 
                    onClick={() => navigate("/login")}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    로그인 페이지로 돌아가기
                  </Button>
                  <Button 
                    onClick={() => {
                      setSuccess(false);
                      setEmail("");
                    }}
                    variant="outline"
                    className="w-full bg-transparent border-white/30 text-white hover:bg-white/10"
                  >
                    다른 이메일로 다시 시도
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-white hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">YT</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-pink-300 to-red-600 bg-clip-text text-transparent">
                YouTube Pulse
              </h1>
              <p className="text-gray-300 text-sm">실시간 유튜브 트렌드 분석 플랫폼</p>
            </div>
          </Link>
        </div>

        {/* Forgot Password Form */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">비밀번호 찾기</CardTitle>
            <CardDescription className="text-gray-300">
              가입하신 이메일 주소를 입력하시면<br />
              비밀번호 재설정 링크를 보내드립니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">이메일 주소</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="가입하신 이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-white/40 pl-10"
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/20 border border-red-400/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    이메일 발송 중...
                  </>
                ) : (
                  <>
                    임시 비밀번호 이메일 보내기
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Additional Links */}
            <div className="mt-6 text-center space-y-2">
              <Link 
                to="/login" 
                className="text-sm text-gray-300 hover:text-white transition-colors block"
              >
                로그인 페이지로 돌아가기
              </Link>
              <Link 
                to="/register" 
                className="text-sm text-gray-300 hover:text-white transition-colors block"
              >
                계정이 없으신가요? 회원가입
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="mt-6 p-4 bg-blue-500/20 rounded-lg border border-blue-400/30">
          <h3 className="text-sm font-medium text-blue-200 mb-2">도움이 필요하신가요?</h3>
          <p className="text-xs text-blue-300">
            비밀번호 재설정 링크가 이메일로 전송되지 않는다면, 
            입력하신 이메일 주소가 정확한지 확인해주세요. 
            여전히 문제가 있다면 고객지원팀에 문의해주세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;






