"use client";

interface Message {
  id: number;
  type: "success" | "danger" | "info";
  text: string;
}

interface Props {
  messages: Message[];
  onDismiss: (id: number) => void;
}

const alertClass: Record<string, string> = {
  success: "bg-green-50 border border-green-200 text-green-800 p-4 rounded",
  danger: "bg-red-50 border border-red-200 text-red-800 p-4 rounded",
  info: "bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded",
};

export default function QueryMessages({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="mb-3">
      {messages.map((msg) => (
        <div key={msg.id} className={`${alertClass[msg.type] || alertClass.info} mb-2`} role="alert">
          <i className="fas fa-info-circle mr-2"></i>{msg.text}
          <button
            type="button"
            className="float-right bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none"
            onClick={() => onDismiss(msg.id)}
          >&times;</button>
        </div>
      ))}
    </div>
  );
}
