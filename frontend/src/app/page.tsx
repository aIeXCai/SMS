'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FullScreenSignup } from "@/components/ui/full-screen-signup";
import Link from 'next/link';

const SignupPage = () => {
  const { user, isAuthenticated, isInitializing, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 在初始化完成且用户未认证时，重定向到登录页
    if (!isInitializing && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  // 在加载期间或用户未认证时，不渲染任何内容（或显示加载指示器）
  if (isInitializing || !isAuthenticated) {
    return <div>加载中...</div>; // 或者返回 null
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>欢迎, {user?.username}!</h1>
      <p>您已成功登录学生管理系统。</p>
      <div>
        <h2>您的信息:</h2>
        <ul>
          <li>ID: {user?.id}</li>
          <li>邮箱: {user?.email || '未提供'}</li>
          <li>
            角色:
            <ul>
              {user?.roles.map(role => (
                <li key={role.id}>{role.name} ({role.code})</li>
              ))}
            </ul>
          </li>
        </ul>
        <nav style={{ marginTop: '1rem' }}>
          <Link href="/students" style={{ marginRight: '1rem', color: '#0070f3' }}>
            学生列表
          </Link>
          {/* 在这里可以添加更多导航链接 */}
        </nav>
      </div>
      <button 
        onClick={logout}
        style={{ 
          marginTop: '1rem', 
          padding: '0.5rem 1rem', 
          backgroundColor: '#ef4444', 
          color: 'white', 
          border: 'none', 
          borderRadius: '0.375rem',
          cursor: 'pointer'
        }}
      >
        登出
      </button>
    </div>
  );
};

export default SignupPage;