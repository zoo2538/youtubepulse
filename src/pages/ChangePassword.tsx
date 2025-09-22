import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (formData.newPassword !== formData.confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);

    try {
      // 로컬 스토리지에서 사용자 데이터 확인
      const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const defaultAdmin = {
        id: "admin-1",
        email: "ju9511503@gmail.com",
        password: "@ju9180417"
      };
      
      const allUsers = [defaultAdmin, ...storedUsers];
      const user = allUsers.find(u => u.email === userEmail);
      
      if (!user) {
        setError("사용자 정보를 찾을 수 없습니다.");
        setIsLoading(false);
        return;
      }
      
      // 현재 비밀번호 확인
      if (user.password !== formData.currentPassword) {
        setError("현재 비밀번호가 올바르지 않습니다.");
        setIsLoading(false);
        return;
      }
      
      // 비밀번호 업데이트
      const updatedUsers = storedUsers.map((u: any) => 
        u.email === userEmail ? { ...u, password: formData.newPassword } : u
      );
      localStorage.setItem('users', JSON.stringify(updatedUsers));
      
      setIsLoading(false);
      setSuccess(true);
      
      // 3초 후 대시보드로 이동
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      setError("비밀번호 변경 중 오류가 발생했습니다.");
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
                <h2 className="text-2xl font-bold text-white">비밀번호 변경 완료!</h2>
                <p className="text-gray-300">
                  비밀번호가 성공적으로 변경되었습니다.<br />
                  잠시 후 대시보드로 이동합니다.
                </p>
                <div className="pt-4">
                  <Link to="/dashboard">
                    <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                      대시보드로 이동
                    </Button>
                  </Link>
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
        {/* Back to Dashboard */}
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center text-white hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            대시보드로 돌아가기
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

        {/* Change Password Form */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">비밀번호 변경</CardTitle>
            <CardDescription className="text-gray-300">
              보안을 위해 정기적으로 비밀번호를 변경해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-white">현재 비밀번호</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="현재 비밀번호를 입력하세요"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-white/40 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-white/10 text-gray-400 hover:text-white"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">새 비밀번호</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-white/40 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-white/10 text-gray-400 hover:text-white"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">새 비밀번호 확인</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="새 비밀번호를 다시 입력하세요"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-white/40 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-white/10 text-gray-400 hover:text-white"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
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
                {isLoading ? "비밀번호 변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword;
