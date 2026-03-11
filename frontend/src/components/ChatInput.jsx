import React from "react";

export default function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  placeholder = "Ask about CV improvements, jobs, interviews, skills, or roadmap...",
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-input-row">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        disabled={loading}
      />
      <button onClick={onSend} disabled={loading || !value.trim()}>
        {loading ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
