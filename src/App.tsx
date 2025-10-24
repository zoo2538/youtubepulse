import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ChunkErrorBoundary from "@/components/ChunkErrorBoundary";
import { hybridService } from "@/lib/hybrid-service";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import UserManagement from "./pages/UserManagement";
import Dashboard from "./pages/Dashboard";
import CategoryChannelRanking from "./pages/CategoryChannelRanking";
import CategoryDailyDetail from "./pages/CategoryDailyDetail";
import ChannelDetail from "./pages/ChannelDetail";
import System from "./pages/System";
import DataClassification from "@/pages/DataClassification";
import DateClassificationDetail from "@/pages/DateClassificationDetail";
import TrendingVideosDetail from "@/pages/TrendingVideosDetail";
import SubcategorySettings from "@/pages/SubcategorySettings";
import NotFound from "./pages/NotFound";
import { AuthHealthCheck } from "@/components/AuthHealthCheck";

const App = () => {
  // GitHub Pages 리다이렉트 플래그 초기화 및 아웃박스 초기화 (페이지 로드 후)
  React.useEffect(() => {
    // 페이지가 완전히 로드된 후 리다이렉트 플래그 정리
    const timer = setTimeout(() => {
      sessionStorage.removeItem('redirecting');
      console.log('🧹 리다이렉트 플래그 정리 완료');
      
      // 아웃박스 서비스 초기화
      hybridService.initializeOutbox();
      console.log('📦 아웃박스 서비스 초기화 완료');
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ChunkErrorBoundary>
      <BrowserRouter basename="/" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/category" element={<Navigate to="/dashboard" replace />} />
          <Route path="/category/:category" element={<CategoryChannelRanking />} />
          <Route path="/category-detail/:category" element={<CategoryDailyDetail />} />
          <Route path="/channel/:channelId" element={<ChannelDetail />} />
          <Route path="/system" element={<System />} />
          <Route path="/data" element={<DataClassification />} />
          <Route path="/data-classification" element={<DataClassification />} />
          <Route path="/date-classification-detail" element={<DateClassificationDetail />} />
          <Route path="/trending-videos" element={<TrendingVideosDetail />} />
          <Route path="/subcategory-settings" element={<SubcategorySettings />} />
          {/* 임시 스모크 테스트 라우트 - 테스트 후 제거 */}
          <Route path="/health/auth" element={<AuthHealthCheck />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
    </ChunkErrorBoundary>
  );
};

export default App;
