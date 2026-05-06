"use client";

import type { Message } from "../types";

interface Props {
  messages: Message[];
  onDismiss: (id: number) => void;
}

export default function MessagesPanel({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="mb-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`alert alert-${msg.type} alert-dismissible fade show`}
          role="alert"
        >
          <i className="fas fa-info-circle mr-2"></i>
          {msg.text}
          <button
            type="button"
            className="bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none ml-2"
            onClick={() => onDismiss(msg.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
