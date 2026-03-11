import { useEffect, useRef, useState } from "react";
import { nodeClient, normalizeApiError } from "../api/api";
import ChatMessage from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";
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
  const [errorMessage, setErrorMessage] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input.trim();
    const userMessage = { role: "user", content: currentInput };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setErrorMessage("");

    try {
      const { data } = await nodeClient.post("/chat/send", {
        message: currentInput,
        sessionId,
      });

      if (!sessionId && data?.sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.reply ||
            "I received your message, but I could not generate a proper response.",
        },
      ]);
    } catch (error) {
      console.error("Career coach chat error:", error);

      const friendlyError =
        normalizeApiError(error) || "Failed to contact career coach service.";

      setErrorMessage(friendlyError);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong while contacting your career coach. Please try again.",
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

        {errorMessage && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.12)",
              color: "#fecaca",
              fontSize: "14px",
            }}
          >
            {errorMessage}
          </div>
        )}

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <ChatMessage key={index} role={msg.role} content={msg.content} />
          ))}

          {loading && (
            <ChatMessage
              role="assistant"
              content="Thinking about your profile and CV..."
            />
          )}

          <div ref={bottomRef} />
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          loading={loading}
        />
      </section>
    </div>
  );
}
