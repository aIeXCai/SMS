"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        // 登录成功，跳转到首页（或你希望的页面）
        router.push('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || '登录失败，请检查用户名/密码');
      }
    } catch (err) {
      setError('网络错误，无法登录');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '6rem auto', padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>登录</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div role="alert" style={{ color: 'crimson', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '10px 12px', background: '#017b6c', color: '#fff', border: 'none', borderRadius: 6 }}
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a href="/" style={{ color: '#017b6c' }}>返回注册页面</a>
      </div>
    </div>
  );
}
