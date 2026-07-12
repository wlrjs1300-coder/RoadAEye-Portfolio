"use client";

import { useState, useRef, useEffect } from "react";
import { Bot } from "lucide-react";

interface Message {
  role: "bot" | "user";
  text: string;
  time: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "안녕하세요! ROAD A EYE 관제 시스템에 대해 궁금한 점을 물어보세요.", time: "" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionNo, setCurrentSessionNo] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setIsLoggedIn(!!localStorage.getItem("access_token"));
    check();
    window.addEventListener("login-state-changed", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("login-state-changed", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    const time = getCurrentTime();

    setMessages(prev => [...prev, { role: "user", text: userMessage, time }]);
    setInput("");
    setIsLoading(true);

    setMessages(prev => [...prev, { role: "bot", text: "", time: getCurrentTime() }]);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("로그인 후 챗봇을 이용해 주세요.");
      }

      const params = new URLSearchParams({ message: userMessage });
      if (currentSessionNo) params.set("session_no", String(currentSessionNo));

      const response = await fetch(`/api/chat/stream?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const rawText = await response.text();
      const lines = rawText.split("\n\n");

      let botReply = "";
      for (const line of lines) {
        if (!line.trim() || !line.startsWith("data: ")) continue;
        const jsonStr = line.replace("data: ", "").trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === "session") {
            setCurrentSessionNo(parsed.session_no);
          } else if (parsed.type === "token") {
            botReply += parsed.content;
          } else if (parsed.type === "done") {
            if (!botReply && typeof parsed.content === "string") {
              botReply = parsed.content;
            }
          } else if (parsed.type === "error") {
            botReply = parsed.message;
          }
        } catch { /* skip */ }
      }

      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.role === "bot") {
          next[lastIdx] = { ...next[lastIdx], text: botReply || "응답을 받지 못했습니다." };
        }
        return next;
      });
    } catch (error) {
      console.error("챗봇 통신 장애:", error);
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        const message = error instanceof Error ? error.message : "서버와의 연결이 원활하지 않습니다.";
        if (next[lastIdx]?.role === "bot") {
          next[lastIdx] = { ...next[lastIdx], text: message };
          return next;
        }
        return [...next, { role: "bot", text: message, time: getCurrentTime() }];
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <div
        id="chat-bubble"
        onClick={() => setIsOpen(prev => !prev)}
        title="AI 챗봇"
        aria-label="AI 챗봇 열기/닫기"
      >
        <Bot size={38} strokeWidth={2.2} />
      </div>

      {isOpen && (
        <div
          id="chat-window"
          style={{
            background: "var(--chat-window-bg)",
            color: "var(--text)",
            border: "1px solid var(--chat-border)",
          }}
        >
          <div className="chat-header">
            <strong>AI Assistant (Road A Eye)</strong>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div id="chat-messages" style={{ overflowY: "auto", maxHeight: "400px" }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`msg-wrapper ${msg.role}`}>
                {msg.role === "user" && (
                  <span className="chat-time" style={{ fontSize: "10px", marginRight: "5px", alignSelf: "flex-end", color: "var(--text-muted)" }}>
                    {msg.time}
                  </span>
                )}
                <div
                  className={`${msg.role}-msg`}
                  style={{
                    background: msg.role === "bot" ? "var(--chat-msg-bot)" : "var(--chat-msg-user)",
                    color: "var(--text)",
                    padding: "10px",
                    borderRadius: "10px",
                    maxWidth: "70%",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.text || (isLoading && idx === messages.length - 1 ? (
                    <span className="typing-dots"><span /><span /><span /></span>
                  ) : "")}
                </div>
                {msg.role === "bot" && (
                  <span className="chat-time" style={{ fontSize: "10px", marginLeft: "5px", alignSelf: "flex-end", color: "var(--text-muted)" }}>
                    {msg.time}
                  </span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area" style={{ background: "var(--chat-border)" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              style={{ background: "var(--chat-input-bg)", color: "var(--text)" }}
              placeholder={isLoading ? "답변을 작성하는 중입니다..." : "메시지를 입력하세요..."}
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading}>
              {isLoading ? "..." : "전송"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
