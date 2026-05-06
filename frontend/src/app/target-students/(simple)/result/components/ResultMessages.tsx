"use client";

import type { Msg } from "../types";

interface Props {
  messages: Msg[];
  onDismiss: (id: number) => void;
}

const alertClass: Record<string, string> = {
  success: "bg-green-50 border border-green-200 text-green-800",
  danger: "bg-red-50 border border-red-200 text-red-800",
  info: "bg-blue-50 border border-blue-200 text-blue-800",
};

export default function ResultMessages({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="mb-3">
      {messages.map((msg) => (
        <div key={msg.id} className={`mb-2 p-4 rounded ${alertClass[msg.type] || alertClass.info}`} role="alert">
          <i className="fas fa-info-circle mr-2"></i>
          {msg.text}
          <button
            type="button"
            className="float-right bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none"
            onClick={() => onDismiss(msg.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
