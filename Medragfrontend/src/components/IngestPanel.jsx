import { useState } from "react";

const PRESET_TOPICS = [
  "hypertension treatment guidelines",
  "type 2 diabetes mellitus management",
  "antibiotic resistance clinical treatment",
  "COVID-19 pharmacological treatment",
  "heart failure drug therapy",
  "cancer immunotherapy clinical trials",
  "sepsis management antibiotics",
  "stroke thrombolysis treatment",
  "asthma inhaler therapy",
  "atrial fibrillation anticoagulation",
];

export default function IngestPanel() {
  const [queries, setQueries] = useState("");
  const [maxPerQuery, setMaxPerQuery] = useState(50);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    const queryList = queries
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);

    if (queryList.length === 0) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/ingest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: queryList, max_per_query: maxPerQuery }),
        }
      );
      const data = await res.json();
      setStatus({ type: "success", message: `Ingestion started for ${data.queries} queries. Check server logs.` });
    } catch (e) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const addPreset = (topic) => {
    setQueries((prev) =>
      prev ? `${prev}\n${topic}` : topic
    );
  };

  return (
    <div className="ingest-panel">
      <div className="ingest-header">
        <h2>Ingest PubMed Articles</h2>
        <p>Add medical topics to expand the knowledge base. Each query fetches real PubMed abstracts.</p>
      </div>

      <div className="ingest-presets">
        <span className="preset-label">Quick Add:</span>
        <div className="preset-chips">
          {PRESET_TOPICS.map((t) => (
            <button key={t} className="preset-chip" onClick={() => addPreset(t)}>
              + {t}
            </button>
          ))}
        </div>
      </div>

      <div className="ingest-form">
        <label className="ingest-label">
          Search Queries (one per line)
        </label>
        <textarea
          className="ingest-textarea"
          value={queries}
          onChange={(e) => setQueries(e.target.value)}
          placeholder={"hypertension treatment\ntype 2 diabetes drug therapy\nCOVID-19 antivirals"}
          rows={8}
        />

        <div className="ingest-options">
          <div className="option-row">
            <label>Max articles per query</label>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={maxPerQuery}
              onChange={(e) => setMaxPerQuery(Number(e.target.value))}
            />
            <span className="option-value">{maxPerQuery}</span>
          </div>
        </div>

        <button
          className="btn-ingest"
          onClick={handleIngest}
          disabled={loading || !queries.trim()}
        >
          {loading ? "Starting Ingestion…" : "⬆ Start PubMed Ingestion"}
        </button>
      </div>

      {status && (
        <div className={`ingest-status ${status.type}`}>
          {status.type === "success" ? "✓" : "⚠"} {status.message}
        </div>
      )}

      <div className="ingest-note">
        <strong>Note:</strong> Ingestion runs in the background. Large queries may take several minutes.
        The system uses Entrez API (free) and respects NCBI rate limits automatically.
      </div>
    </div>
  );
}
