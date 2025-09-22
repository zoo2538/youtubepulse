import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMAILJS_CONFIG } from '@/config/emailjs';

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string | null;
  userRole: 'admin' | 'user' | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 페이지 로드 시 로그인 상태 확인 (세션 기반 - 저장소 사용 안함)
    const checkAuthStatus = () => {
      // 창을 새로 열 때마다 로그인 상태 초기화
      setIsLoggedIn(false);
      setUserEmail(null);
      setUserRole(null);
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // 간단한 로그인 로직 (실제로는 API 호출)
    return new Promise((resolve) => {
      setTimeout(() => {
        // 사용자 데이터 확인
        const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
        
        // 기본 관리자 계정의 비밀번호 확인
        let adminPassword = "@ju9180417"; // 기본 비밀번호
        console.log('🔍 로그인 시도 - 이메일:', email, '비밀번호:', password);
        console.log('🔍 관리자 계정 비밀번호:', adminPassword);
        
        const defaultAdmin = {
          id: "admin-1",
          name: "관리자",
          email: "ju9511503@gmail.com",
          password: adminPassword,
          status: "active",
          role: "admin"
        };
        
        const allUsers = [defaultAdmin, ...storedUsers];
        const user = allUsers.find(u => u.email === email && u.password === password);
        
        console.log('🔍 찾은 사용자:', user);
        console.log('🔍 사용자 역할:', user?.role);
        
        if (user && user.status === 'active') {
          // 승인된 사용자만 로그인 허용
          setIsLoggedIn(true);
          setUserEmail(email);
          
          // 관리자 이메일 직접 체크
          const isAdminEmail = email === 'ju9511503@gmail.com';
          const finalRole = isAdminEmail ? 'admin' : (user.role || 'user');
          setUserRole(finalRole);
          
          console.log('✅ 로그인 성공:', { email, role: finalRole, isAdminEmail });
          
          // 임시 비밀번호로 로그인한 경우 즉시 만료 처리
          if (EMAILJS_CONFIG.PUBLIC_KEY !== 'your_public_key_here' && adminTempPasswordData) {
            const tempData = JSON.parse(adminTempPasswordData);
            if (tempData.tempPassword === password) {
              localStorage.removeItem('adminTempPassword');
              console.log('🔒 임시 비밀번호 사용 후 즉시 만료 처리');
            }
          }
          
          resolve(true);
        } else if (user && user.status === 'pending') {
          // 승인 대기 중인 사용자
          resolve(false);
        } else {
          // 사용자를 찾을 수 없거나 비밀번호가 틀림
          resolve(false);
        }
        setIsLoading(false);
      }, 1000);
    });
  };

  const logout = () => {
    // 저장소 사용 안함 - 메모리에서만 제거
    setIsLoggedIn(false);
    setUserEmail(null);
    setUserRole(null);
    // React Router의 navigate 사용 (가장 일반적인 방법)
    navigate('/login', { replace: true });
  };

  const value = {
    isLoggedIn,
    userEmail,
    userRole,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
