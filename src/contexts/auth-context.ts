import { createContext } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string | null;
  userRole: 'admin' | 'user' | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export type { AuthContextType };
