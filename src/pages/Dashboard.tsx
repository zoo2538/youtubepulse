import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { ChannelTrendingTable } from "@/components/dashboard/channel-trending-table";
import { TrendingVideosGrid } from "@/components/dashboard/trending-videos-grid";
import { PerformanceVideosList } from "@/components/dashboard/performance-videos-list";
import { Button } from "@/components/ui/button";
import { Settings, Users, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/ui/logo";
import { useEffect } from "react";

const Dashboard = () => {
  const { userEmail, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userRole === 'admin';

  // 임시 비밀번호 기능은 현재 비활성화 상태
  // useEffect(() => {
  //   // 임시 비밀번호 감지 로직 비활성화
  // }, [userEmail, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
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
              <Link to="/change-password">
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  비밀번호 변경
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  국내
                </Button>
              </Link>
              <Link to="/data">
                <Button 
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  📊 데이터
                </Button>
              </Link>
              <Link to="/system">
                <Button 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/user-management">
                  <Button 
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    회원관리
                  </Button>
                </Link>
              )}
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        <DashboardFilters />
        <DashboardOverview />
        
        <div className="space-y-6">
          <ChannelTrendingTable />
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TrendingVideosGrid />
            <PerformanceVideosList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
