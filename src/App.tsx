import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import UserManagement from "./pages/UserManagement";
import Dashboard from "./pages/Dashboard";
import CategoryChannelRanking from "./pages/CategoryChannelRanking";
import CategoryDailyDetail from "./pages/CategoryDailyDetail";
import ChannelDetail from "./pages/ChannelDetail";
import System from "./pages/System";
import DataClassification from "@/pages/DataClassification";
import DateClassificationDetail from "@/pages/DateClassificationDetail";
import TrendingVideosDetail from "@/pages/TrendingVideosDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/category" element={<Navigate to="/dashboard" replace />} />
            <Route path="/category/:category" element={<CategoryChannelRanking />} />
            <Route path="/category-detail/:category" element={<CategoryDailyDetail />} />
            <Route path="/channel/:channelId" element={<ChannelDetail />} />
            <Route path="/system" element={<System />} />
            <Route path="/data-classification" element={<DataClassification />} />
            <Route path="/date-classification-detail" element={<DateClassificationDetail />} />
            <Route path="/trending-videos" element={<TrendingVideosDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
