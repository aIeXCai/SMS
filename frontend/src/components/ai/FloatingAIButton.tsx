"use client";

interface FloatingAIButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasUnread?: boolean;
}

export function FloatingAIButton({
  onClick,
  isOpen,
  hasUnread = false,
}: FloatingAIButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "关闭成绩查询助手" : "打开成绩查询助手"}
      type="button"
      className="fixed z-[999] flex items-center justify-center
                 w-14 h-14 rounded-full
                 shadow-lg transition-all duration-200 ease-out
                 hover:scale-105 hover:shadow-xl
                 active:scale-95 group"
      style={{
        right: "24px",
        bottom: "24px",
        backgroundColor: "#01876c",
      }}
    >
      {/* Unread pulse ring */}
      {hasUnread && !isOpen && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
        </>
      )}

      {/* Tooltip on hover */}
      <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-800 text-white text-xs
                       rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100
                       transition-opacity duration-150 pointer-events-none">
        成绩查询助手
      </span>

      {isOpen ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Chat bubble */}
          <path d="M21 11.5a8.5 8.5 0 0 1-11.6 7.9L4 21l1.1-5.2A8.5 8.5 0 1 1 21 11.5z" />
          {/* Sparkle star */}
          <path d="M15.5 6.5l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z" />
        </svg>
      )}
    </button>
  );
}
