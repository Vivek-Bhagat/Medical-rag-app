import { useMemo } from "react";

export default function AnswerPanel({ answer, confidence, verified, queryTime, cached, variant = "panel" }) {
  const isNoAnswer = answer === "No answer found";

  const formattedAnswer = useMemo(() => {
    if (isNoAnswer) return answer;
    // Convert [1], [2] citations to styled spans
    return answer.replace(/\[(\d+)\]/g, (_, n) => `<cite-ref data-n="${n}">[${n}]</cite-ref>`);
  }, [answer, isNoAnswer]);

  const confidenceLabel = confidence >= 0.75 ? "High" : confidence >= 0.45 ? "Moderate" : "Low";
  const confidenceClass = confidence >= 0.75 ? "high" : confidence >= 0.45 ? "moderate" : "low";

  return (
    <div className={`answer-panel ${variant === "chat" ? "answer-panel--chat" : ""} ${isNoAnswer ? "no-answer" : "has-answer"}`}>
      <div className="answer-header">
        <h2 className="answer-title">
          {isNoAnswer ? "⚠ No Answer Found" : "Evidence-Based Answer"}
        </h2>
        <div className="answer-meta">
          {!isNoAnswer && (
            <span className={`confidence-badge ${confidenceClass}`}>
              Confidence: {confidenceLabel} ({(confidence * 100).toFixed(0)}%)
            </span>
          )}
          {verified && (
            <span className="verified-badge">✓ Verified</span>
          )}
          {cached && (
            <span className="cached-badge">⚡ Cached</span>
          )}
          <span className="time-badge">{queryTime?.toFixed(0)}ms</span>
        </div>
      </div>

      <div className="answer-body">
        {isNoAnswer ? (
          <div className="no-answer-content">
            <p>The system could not find a reliable, evidence-based answer for this query in the indexed PubMed literature.</p>
            <ul>
              <li>Try rephrasing your question with more specific clinical terms</li>
              <li>Ingest more relevant PubMed articles via the Ingest tab</li>
              <li>Consult clinical guidelines directly (UpToDate, NEJM, etc.)</li>
            </ul>
          </div>
        ) : (
          <AnswerText html={formattedAnswer} />
        )}
      </div>

      {!isNoAnswer && (
        <div className="answer-disclaimer">
          ⚕ This answer is generated from indexed PubMed abstracts. Always verify with full-text literature and apply clinical judgment.
        </div>
      )}
    </div>
  );
}

function AnswerText({ html }) {
  // Parse and render answer with citation links
  const parts = [];
  const regex = /<cite-ref data-n="(\d+)">\[(\d+)\]<\/cite-ref>/g;
  let last = 0;
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={`text-${last}`}>
          {html.slice(last, match.index)}
        </span>
      );
    }
    const n = match[1];
    parts.push(
      <a
        key={`cite-${match.index}`}
        href={`#source-${n}`}
        className="citation-link"
        title={`Go to source ${n}`}
      >
        [{n}]
      </a>
    );
    last = match.index + match[0].length;
  }

  if (last < html.length) {
    parts.push(<span key="text-end">{html.slice(last)}</span>);
  }

  return <div className="answer-text">{parts}</div>;
}
