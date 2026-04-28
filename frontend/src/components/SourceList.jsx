import { useState } from "react";

export default function SourceList({ sources }) {
  return (
    <div className="source-list">
      <h3 className="sources-title">
        <span className="sources-icon">📚</span>
        Sources ({sources.length})
      </h3>
      <div className="sources-container">
        {sources.map((source) => (
          <SourceCard key={source.pmid} source={source} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);

  const scoreClass =
    source.score >= 0.6 ? "score-high" :
    source.score >= 0.3 ? "score-mid" :
    "score-low";

  return (
    <div className="source-card" id={`source-${source.rank}`}>
      <div className="source-header">
        <div className="source-rank">[{source.rank}]</div>
        <div className="source-info">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-title"
          >
            {source.title}
          </a>
          <div className="source-meta">
            <span className="source-pmid">PMID: {source.pmid}</span>
            <span className={`source-score ${scoreClass}`}>
              Relevance: {(source.score * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        <button
          className="expand-btn"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse abstract" : "Expand abstract"}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className="source-abstract">
          <p>{source.abstract}</p>
          <div className="source-actions">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pubmed"
            >
              View on PubMed →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
