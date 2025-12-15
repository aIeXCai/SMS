"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenLogin } from "@/components/ui/full-screen-signup";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch('/api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const { access, refresh } = await res.json();
        await login(access, refresh);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || '登录失败，请检查用户名/密码');
      }
    } catch (err) {
      setError('网络错误，无法连接到服务器');
    } finally {
      setLoading(false);
    }
  }

  return (
    <FullScreenLogin
      username={username}
      password={password}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
    />
  );
}