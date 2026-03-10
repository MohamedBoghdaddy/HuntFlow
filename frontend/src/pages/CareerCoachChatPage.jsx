import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "../styles/careerCoachChat.css";

export default function CareerCoachChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I’m your AI career coach. Ask me about your CV, job targeting, projects, interview prep, or skill roadmap.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post("/chat/send", {
        message: currentInput,
        sessionId,
      });

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong while contacting your career coach. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="career-chat-page">
      <aside className="career-chat-sidebar">
        <h2>Career Coach</h2>
        <p>Your profile, CV insights, and guided career chat in one place.</p>

        <div className="coach-card">
          <h3>What you can ask</h3>
          <ul>
            <li>How can I improve my CV?</li>
            <li>What roles fit my background?</li>
            <li>Make me a 30-day roadmap</li>
            <li>Prepare me for HR interview</li>
            <li>What projects should I build?</li>
          </ul>
        </div>
      </aside>

      <section className="career-chat-main">
        <div className="chat-header">
          <h1>AI Career Coach Chat</h1>
          <span>CV-aware coaching</span>
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-bubble ${msg.role}`}>
              <div className="chat-role">{msg.role === "user" ? "You" : "Coach"}</div>
              <div className="chat-content">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble assistant">
              <div className="chat-role">Coach</div>
              <div className="chat-content">Thinking about your profile and CV...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about CV improvements, jobs, interviews, skills, or roadmap..."
            rows={3}
          />
          <button onClick={sendMessage} disabled={loading}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}