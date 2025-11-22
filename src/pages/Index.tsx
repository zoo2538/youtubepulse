import { Button } from "@/components/ui/button";
import { Settings, Globe, Home, LogIn, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { isLoggedIn } = useAuth();

  const handleProtectedClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault();
      alert("로그인이 필요합니다. 먼저 로그인해주세요.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">YT</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-pink-300 to-red-600 bg-clip-text text-transparent">
                YouTube Pulse
              </h1>
              <p className="text-gray-300 text-sm">실시간 유튜브 트렌드 분석 플랫폼</p>
            </div>
          </Link>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-3">
            <Link to="/login">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <LogIn className="w-4 h-4 mr-2" />
                로그인
              </Button>
            </Link>
            <Link to="/dashboard" onClick={handleProtectedClick}>
              <Button 
                variant="destructive" 
                size="sm"
                className={`${isLoggedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500 cursor-not-allowed'} text-white`}
                disabled={!isLoggedIn}
              >
                국내
              </Button>
            </Link>
            <Link to="/trend" onClick={handleProtectedClick}>
              <Button 
                size="sm"
                className={`${isLoggedIn ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 cursor-not-allowed'} text-white`}
                disabled={!isLoggedIn}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                트렌드
              </Button>
            </Link>
            <Link to="/data" onClick={handleProtectedClick}>
              <Button 
                size="sm"
                className={`${isLoggedIn ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-500 cursor-not-allowed'} text-white`}
                disabled={!isLoggedIn}
              >
                📊 데이터
              </Button>
            </Link>
            <Link to="/trend" onClick={handleProtectedClick}>
              <Button 
                size="sm"
                className={`${isLoggedIn ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 cursor-not-allowed'} text-white`}
                disabled={!isLoggedIn}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                트렌드
              </Button>
            </Link>
            <Link to="/system" onClick={handleProtectedClick}>
              <Button 
                size="sm"
                className={`${isLoggedIn ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-500 cursor-not-allowed'} text-white`}
                disabled={!isLoggedIn}
              >
                <Settings className="w-4 h-4 mr-2" />
                시스템
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          {/* Main Heading */}
          <div className="space-y-4">
            <h2 className="text-6xl font-bold text-white leading-tight">
              유튜브 트렌드의
            </h2>
            <h2 className="text-6xl font-bold text-red-500 leading-tight">
              모든 것을
            </h2>
            <h2 className="text-6xl font-bold text-white leading-tight">
              한눈에
            </h2>
          </div>

          {/* Subtitle */}
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            국내외 유튜브 영상을 분석하여 트렌드를 확인하세요
          </p>

          {/* CTA Button */}
          <div className="pt-8">
            <Link to="/dashboard" onClick={handleProtectedClick}>
              <Button 
                size="lg"
                className={`${isLoggedIn ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' : 'bg-gray-500 cursor-not-allowed'} text-white text-lg px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300`}
                disabled={!isLoggedIn}
              >
                <Home className="w-5 h-5 mr-2" />
                {isLoggedIn ? '대시보드 시작하기' : '로그인 후 이용 가능'}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            © 2025 YouTube Pulse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
