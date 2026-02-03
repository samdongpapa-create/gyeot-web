"use client";

import { useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "지금 떠오르는 생각, 굳이 정리 안 해도 돼." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "…" }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "지금은 잠깐 연결이 불안정해. 괜찮으면 다시 한 번만 말해줄래." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "white", color: "#111" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} style={{ textAlign: isUser ? "right" : "left" }}>
                <div
                  style={{
                    display: "inline-block",
                    maxWidth: "90%",
                    whiteSpace: "pre-wrap",
                    borderRadius: 18,
                    padding: "10px 12px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    background: isUser ? "#111" : "#f2f2f2",
                    color: isUser ? "white" : "#111"
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          {loading && (
            <div style={{ textAlign: "left" }}>
              <div style={{ display: "inline-block", borderRadius: 18, padding: "10px 12px", background: "#f2f2f2", fontSize: 14, color: "#666" }}>
                …
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: "flex", gap: 8, borderTop: "1px solid #eee", paddingTop: 14, marginTop: 16 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="하고 싶은 말 아무거나…"
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid #ddd",
              outline: "none",
              fontSize: 14
            }}
          />
          <button
            onClick={send}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            보내기
          </button>
        </div>
      </div>
    </main>
  );
}
