import { useState, useCallback } from "react";
import QueryInput from "./components/QueryInput";
import AnswerPanel from "./components/AnswerPanel";
import SourceList from "./components/SourceList";
import StatusBar from "./components/StatusBar";
import Header from "./components/Header";
import IngestPanel from "./components/IngestPanel";
import { useSystemStatus } from "./hooks/useSystemStatus";
import "./styles/global.css";

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("query"); // "query" | "ingest"
  const { status } = useSystemStatus();

  const handleQuery = useCallback(async (query, options) => {
    setLoading(true);
    setError(null);
    setResult(null);

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
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
          <div className="query-layout">
            <QueryInput onSubmit={handleQuery} loading={loading} />

            {error && (
              <div className="error-banner">
                <span className="error-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="loading-container">
                <div className="loading-steps">
                  <LoadingStep delay={0} label="Searching PubMed index" />
                  <LoadingStep delay={800} label="Hybrid BM25 + Vector retrieval" />
                  <LoadingStep delay={1600} label="Re-ranking with CrossEncoder" />
                  <LoadingStep delay={2400} label="Generating evidence-based answer" />
                  <LoadingStep delay={3200} label="Verifying citations & claims" />
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="results-layout">
                <AnswerPanel
                  answer={result.answer}
                  confidence={result.confidence}
                  verified={result.verified}
                  queryTime={result.query_time_ms}
                  cached={result.cached}
                />
                {result.sources && result.sources.length > 0 && (
                  <SourceList sources={result.sources} />
                )}
              </div>
            )}
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

function LoadingStep({ delay, label }) {
  const [visible, setVisible] = useState(false);

  useState(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`loading-step ${visible ? "visible" : ""}`}>
      <span className="step-dot" />
      <span>{label}</span>
    </div>
  );
}
