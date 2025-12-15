"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// 定义用户和认证状态的类型
interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  managed_grade?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (access: string, refresh: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

// 创建上下文，并提供一个默认值
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 定义 AuthProvider 的 props
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 在应用加载时，尝试从 localStorage 恢复 token
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      setToken(storedToken);
      fetchUserProfile(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const response = await fetch('/api/users/me/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token 可能已过期，尝试刷新或登出
        logout();
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (access: string, refresh: string) => {
    setLoading(true);
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    setToken(access);
    await fetchUserProfile(access);

    // 登录成功后跳转到后端 Django 系统，并通过URL参数传递token
    // 注意：这种方式在生产环境中需要更安全的实现，比如使用cookie或session
    const backendUrl = `http://${window.location.hostname}:8000/?token=${encodeURIComponent(access)}`;
    window.location.href = backendUrl;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login'); // 登出后跳转到登录页
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义 hook，方便在组件中使用
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
