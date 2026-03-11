import React from "react";

export default function ChatMessage({ role, content }) {
  return (
    <div className={`chat-bubble ${role}`}>
      <div className="chat-role">{role === "user" ? "You" : "Coach"}</div>
      <div className="chat-content">{content}</div>
    </div>
  );
}
