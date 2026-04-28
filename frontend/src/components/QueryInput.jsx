import { useState } from "react";

const EXAMPLE_QUERIES = [
  "What is the first-line treatment for hypertension in patients with CKD?",
  "What are the contraindications of metformin in type 2 diabetes?",
  "What antibiotic is recommended for community-acquired pneumonia?",
  "What is the mechanism of action of warfarin and its drug interactions?",
  "What are the indications for thrombolysis in acute ischemic stroke?",
];

export default function QueryInput({ onSubmit, loading }) {
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [maxResults, setMaxResults] = useState(5);
  const [minScore, setMinScore] = useState(0.0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onSubmit(query.trim(), { maxResults, minScore });
  };

  const setExample = (q) => {
    setQuery(q);
  };

  return (
    <div className="query-panel">
      <form onSubmit={handleSubmit} className="query-form">
        <div className="query-input-wrapper">
          <textarea
            className="query-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a clinical question… e.g. What is the recommended dose of amoxicillin for strep throat?"
            rows={3}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="query-actions">
            <button
              type="button"
              className="btn-options"
              onClick={() => setShowOptions(!showOptions)}
            >
              ⚙ Options
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={!query.trim() || loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" /> Analyzing...
                </span>
              ) : (
                "Search Evidence →"
              )}
            </button>
          </div>
        </div>

        {showOptions && (
          <div className="options-panel">
            <div className="option-row">
              <label>Max Sources</label>
              <input
                type="range"
                min={1}
                max={10}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              />
              <span className="option-value">{maxResults}</span>
            </div>
            <div className="option-row">
              <label>Min Relevance Score</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
              />
              <span className="option-value">{minScore.toFixed(2)}</span>
            </div>
          </div>
        )}
      </form>

      <div className="example-queries">
        <span className="example-label">Examples:</span>
        <div className="example-list">
          {EXAMPLE_QUERIES.map((q, i) => (
            <button
              key={i}
              className="example-chip"
              onClick={() => setExample(q)}
              disabled={loading}
            >
              {q.length > 60 ? q.slice(0, 60) + "…" : q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
