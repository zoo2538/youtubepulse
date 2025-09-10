import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string | null;
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
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 페이지 로드 시 로그인 상태 확인 (세션 기반 - 저장소 사용 안함)
    const checkAuthStatus = () => {
      // 창을 새로 열 때마다 로그인 상태 초기화
      setIsLoggedIn(false);
      setUserEmail(null);
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // 간단한 로그인 로직 (실제로는 API 호출)
    return new Promise((resolve) => {
      setTimeout(() => {
        // 데모 계정 확인
        if (email === 'ju9511503@gmail.com' && password === '@ju9180417') {
          // 저장소 사용 안함 - 메모리에만 저장
          setIsLoggedIn(true);
          setUserEmail(email);
          resolve(true);
        } else {
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
    // React Router의 navigate 사용 (가장 일반적인 방법)
    navigate('/login', { replace: true });
  };

  const value = {
    isLoggedIn,
    userEmail,
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
