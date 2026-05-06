import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import QueryInput from "./components/QueryInput";
import AnswerPanel from "./components/AnswerPanel";
import SourceList from "./components/SourceList";
import StatusBar from "./components/StatusBar";
import Header from "./components/Header";
import IngestPanel from "./components/IngestPanel";
import { useSystemStatus } from "./hooks/useSystemStatus";
import "./styles/global.css";

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [messages, setMessages] = useState([]); // chat history
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("query"); // "query" | "ingest"
  const { status } = useSystemStatus();
  const chatEndRef = useRef(null);

  const hasHistory = messages.length > 0;

  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const handleQuery = useCallback(async (query, options) => {
    setLoading(true);
    setError(null);

    const userId = newId();
    const assistantId = newId();

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", query },
      { id: assistantId, role: "assistant", pending: true },
    ]);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          max_results: options.maxResults || 5,
          min_score: options.minScore || 0.0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                pending: false,
                answer: data.answer,
                sources: data.sources,
                confidence: data.confidence,
                verified: data.verified,
                cached: data.cached,
                queryTime: data.query_time_ms,
              }
            : m
        )
      );
    } catch (e) {
      setError(e.message);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, pending: false, error: true, message: e.message }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const chatItems = useMemo(() => {
    return messages.map((m) => {
      if (m.role === "user") {
        return (
          <ChatRow key={m.id} align="right">
            <div className="chat-bubble chat-bubble-user">
              <div className="chat-bubble-label">You</div>
              <div className="chat-bubble-text">{m.query}</div>
            </div>
          </ChatRow>
        );
      }

      if (m.role === "assistant") {
        if (m.pending) {
          return (
            <ChatRow key={m.id} align="left">
              <div className="chat-bubble chat-bubble-assistant">
                <div className="chat-bubble-label">MedRAG</div>
                <div className="chat-thinking">
                  <span className="spinner" /> Thinking…
                </div>
              </div>
            </ChatRow>
          );
        }

        if (m.error) {
          return (
            <ChatRow key={m.id} align="left">
              <div className="chat-bubble chat-bubble-error">
                <div className="chat-bubble-label">Error</div>
                <div className="chat-bubble-text">{m.message}</div>
              </div>
            </ChatRow>
          );
        }

        return (
          <ChatRow key={m.id} align="left">
            <div className="chat-bubble chat-bubble-assistant">
              <div className="chat-bubble-label">MedRAG</div>
              <div className="chat-bubble-content">
                <AnswerPanel
                  variant="chat"
                  answer={m.answer}
                  confidence={m.confidence}
                  verified={m.verified}
                  queryTime={m.queryTime}
                  cached={m.cached}
                />
                {m.sources && m.sources.length > 0 && (
                  <SourceList variant="chat" sources={m.sources} />
                )}
              </div>
            </div>
          </ChatRow>
        );
      }

      return null;
    });
  }, [messages]);

  return (
    <div className="app">
      <Header />
      <StatusBar status={status} />

      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === "query" ? "active" : ""}`}
          onClick={() => setActiveTab("query")}
        >
          <span className="tab-icon">⚕</span> Query
        </button>
        <button
          className={`nav-tab ${activeTab === "ingest" ? "active" : ""}`}
          onClick={() => setActiveTab("ingest")}
        >
          <span className="tab-icon">⬆</span> Ingest Data
        </button>
      </div>

      <main className="main-content">
        {activeTab === "query" && (
          <div className="chat-layout">
            <div className={`chat-history ${hasHistory ? "has-history" : "empty"}`}>
              {!hasHistory && (
                <div className="chat-empty">
                  <div className="chat-empty-title">Chat</div>
                  <div className="chat-empty-subtitle">
                    Ask a clinical question to start. Your history stays in this session.
                  </div>
                </div>
              )}

              {chatItems}

              <div ref={chatEndRef} />
            </div>

            <div className="chat-input">
              <QueryInput onSubmit={handleQuery} loading={loading} variant="chat" showExamples={!hasHistory} />
            </div>
          </div>
        )}

        {activeTab === "ingest" && <IngestPanel />}
      </main>

      <footer className="footer">
        <p>MedRAG · Evidence-based answers from PubMed · No hallucination guarantee</p>
        <p className="footer-warning">⚠ For licensed medical professionals only. Not a substitute for clinical judgment.</p>
      </footer>
    </div>
  );
}

function ChatRow({ align, children }) {
  return <div className={`chat-row ${align === "right" ? "align-right" : "align-left"}`}>{children}</div>;
}
