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
    // 페이지 로드 시 저장된 인증 정보 확인
    const checkAuthStatus = () => {
      try {
        // localStorage에서 사용자 정보 확인
        const storedEmail = localStorage.getItem('userEmail');
        const storedRole = localStorage.getItem('userRole');
        
        console.log('🔍 저장된 인증 정보 확인:', { storedEmail, storedRole });
        
        if (storedEmail && storedRole) {
          setIsLoggedIn(true);
          setUserEmail(storedEmail);
          setUserRole(storedRole as 'admin' | 'user');
          console.log('✅ 저장된 인증 정보 로드 완료:', { storedEmail, storedRole });
        } else {
          console.log('❌ 저장된 인증 정보 없음 - 로그인 필요');
        }
      } catch (error) {
        console.error('❌ 인증 정보 확인 중 오류:', error);
        // 오류 발생 시 로그아웃 상태로 설정
        setIsLoggedIn(false);
        setUserEmail(null);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('🔐 로그인 시도:', email);
      
      // 기본 관리자 계정 확인
      if (email === 'ju9511503@gmail.com' && password === '@ju9180417') {
        // localStorage에 안전하게 저장
        try {
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userRole', 'admin');
          
          setIsLoggedIn(true);
          setUserEmail(email);
          setUserRole('admin');
          
          console.log('✅ 관리자 로그인 성공:', { email, role: 'admin' });
          setIsLoading(false);
          return true;
        } catch (storageError) {
          console.error('❌ localStorage 저장 실패:', storageError);
          setIsLoading(false);
          return false;
        }
      }
      
      // 일반 사용자 확인 (로컬 스토리지에서)
      try {
        const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const user = storedUsers.find((u: any) => u.email === email && u.password === password);
        
        if (user && user.status === 'active') {
          // localStorage에 안전하게 저장
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userRole', user.role || 'user');
          
          setIsLoggedIn(true);
          setUserEmail(email);
          setUserRole(user.role || 'user');
          
          console.log('✅ 사용자 로그인 성공:', { email, role: user.role });
          setIsLoading(false);
          return true;
        }
      } catch (parseError) {
        console.error('❌ 사용자 데이터 파싱 실패:', parseError);
      }
      
      console.log('❌ 로그인 실패: 잘못된 인증 정보');
      setIsLoading(false);
      return false;
      
    } catch (error) {
      console.error('❌ 로그인 에러:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    // localStorage에서 인증 정보 삭제
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    
    // 메모리에서도 제거
    setIsLoggedIn(false);
    setUserEmail(null);
    setUserRole(null);
    
    console.log('✅ 로그아웃 완료 - 인증 정보 삭제됨');
    
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
