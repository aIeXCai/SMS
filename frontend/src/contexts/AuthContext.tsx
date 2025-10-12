"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// 定义用户对象的类型
interface User {
  id: number;
  username: string;
  email: string;
  roles: { id: number; name: string; code: string }[];
}

// 定义 AuthContext 的类型
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isInitializing: boolean; // 用于初始加载状态
  isLoading: boolean;      // 用于登录过程状态
  error: string | null;
}

// 创建 AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 创建一个自定义 Hook，方便在其他组件中使用 AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 创建 AuthProvider 组件
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 后端 API 地址
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // 在组件加载时检查本地存储中是否有 token，并尝试获取用户信息
  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const res = await fetch(`${API_URL}/api/users/me/`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            // Token 无效或过期，清除它
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        } catch (error) {
          console.error('Failed to fetch user info:', error);
          setError('无法连接到服务器。');
        }
      }
      setIsInitializing(false);
    };
    initializeAuth();
  }, []);

  // 登录方法
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/users/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const { access, refresh } = await res.json();
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);

        // 获取用户信息
        const userRes = await fetch(`${API_URL}/api/users/me/`, {
          headers: {
            'Authorization': `Bearer ${access}`
          }
        });
        const userData = await userRes.json();
        setUser(userData);
        router.push('/'); // 登录成功后跳转到主页
      } else {
        const errorData = await res.json();
        setError(errorData.detail || '登录失败，请检查您的用户名和密码。');
      }
    } catch (e) {
      console.error('Login failed:', e);
      setError('登录请求失败，请检查您的网络连接。');
    } finally {
      setIsLoading(false);
    }
  };

  // 登出方法
  const logout = () => {
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login'); // 登出后跳转到登录页
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    isInitializing,
    isLoading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
