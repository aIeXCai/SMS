"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface AIInputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Text to fill into the input (triggered when fillKey changes) */
  fillText?: string;
  /** Increment to trigger fillText application */
  fillKey?: number;
}

export function AIInputBar({
  onSend,
  disabled = false,
  placeholder = "输入您的问题...",
  fillText,
  fillKey,
}: AIInputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Apply external fill text when fillKey changes
  useEffect(() => {
    if (fillText !== undefined && fillText !== null) {
      setValue(fillText);
      // Focus and place cursor at end
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          // Auto-resize
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        }
      });
    }
    // Intentionally only react to fillKey changes, not fillText
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  };

  return (
    <div
      className="flex items-end gap-2 px-4 py-3 border-t border-gray-200 bg-white"
      style={{ minHeight: "64px" }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2
                   text-sm outline-none transition-colors
                   focus:border-[#01876c] focus:ring-1 focus:ring-[#01876c]
                   disabled:bg-gray-50 disabled:text-gray-400
                   placeholder:text-gray-400"
        style={{ maxHeight: "120px" }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        type="button"
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center
                   rounded-full transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#01876c" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
