"use client";
 
import { useState } from "react";

interface FullScreenLoginProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
}
 
export const FullScreenLogin = ({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  loading,
  error
}: FullScreenLoginProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div className="w-full relative max-w-5xl overflow-hidden flex flex-col md:flex-row shadow-xl">
        <div className="w-full h-full z-2 absolute bg-gradient-to-t from-transparent to-black/20"></div>
        <div className="flex absolute z-2 overflow-hidden backdrop-blur-2xl ">
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
          <div className="h-[40rem] z-2 w-[4rem] bg-gradient-to-r from-transparent via-black/50 to-transparent opacity-30 overflow-hidden"></div>
        </div>
        <div className="w-[15rem] h-[15rem] bg-[#01876c] absolute z-1 rounded-full bottom-0 opacity-80"></div>
        <div className="w-[8rem] h-[5rem] bg-white absolute z-1 rounded-full bottom-0 opacity-60"></div>
        <div className="w-[8rem] h-[5rem] bg-white absolute z-1 rounded-full bottom-0 opacity-60"></div>
 
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative rounded-bl-3xl overflow-hidden">
          <h1 className="text-2xl md:text-3xl font-medium leading-tight z-10 tracking-tight relative">
            白云实验学校管理系统
          </h1>
          <p className="text-white/80 mt-4 relative z-10">
            现代化的学校管理解决方案，为教育管理提供全面支持。
          </p>
        </div>
 
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col bg-white z-10 text-gray-900">
          <div className="flex flex-col items-left mb-8">
            <div className="text-[#01876c] mb-4">
              <div className="w-10 h-10 bg-[#01876c] rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🎓</span>
              </div>
            </div>
            <h2 className="text-3xl font-medium mb-2 tracking-tight">
              登录系统
            </h2>
            <p className="text-left opacity-80">
              欢迎回来 — 请输入您的凭据登录
            </p>
          </div>
 
          <form
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <div>
              <label htmlFor="username" className="block text-sm mb-2 font-medium">
                用户名
              </label>
              <input
                type="text"
                id="username"
                placeholder="请输入用户名"
                className="text-sm w-full py-3 px-4 border rounded-lg focus:outline-none focus:ring-2 bg-white text-black focus:ring-[#01876c] border-gray-300 transition-all"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                required
              />
            </div>
 
            <div>
              <label htmlFor="password" className="block text-sm mb-2 font-medium">
                密码
              </label>
              <input
                type="password"
                id="password"
                placeholder="请输入密码"
                className="text-sm w-full py-3 px-4 border rounded-lg focus:outline-none focus:ring-2 bg-white text-black focus:ring-[#01876c] border-gray-300 transition-all"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
 
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#01876c] hover:bg-[#016155] disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>
 
            <div className="text-center text-gray-600 text-sm">
              白云实验学校管理系统 - 安全登录
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
 