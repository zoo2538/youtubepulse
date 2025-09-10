import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle, ArrowRight } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    // 간단한 비밀번호 재설정 로직 (실제로는 API 호출)
    setTimeout(() => {
      setIsLoading(false);
      setSuccess(true);
    }, 2000);
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
                <p className="text-gray-300">
                  <strong className="text-white">{email}</strong>로<br />
                  비밀번호 재설정 링크를 보내드렸습니다.
                </p>
                <p className="text-sm text-gray-400">
                  이메일이 오지 않는다면 스팸 폴더를 확인해주세요.
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
                  "링크 전송 중..."
                ) : (
                  <>
                    재설정 링크 보내기
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

