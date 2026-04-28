export default function StatusBar({ status }) {
  if (!status) return null;

  const isReady = status.status === "ready";

  return (
    <div className={`status-bar ${isReady ? "status-ready" : "status-loading"}`}>
      <div className="status-inner">
        <div className="status-dot-row">
          <span className={`status-dot ${isReady ? "dot-green" : "dot-yellow"}`} />
          <span className="status-text">
            {isReady
              ? `System Ready · ${status.index_size?.toLocaleString() || 0} articles indexed`
              : "System initializing…"}
          </span>
        </div>
        {isReady && (
          <div className="status-tags">
            <span className="status-tag">PubMed FAISS</span>
            <span className="status-tag">BM25</span>
            <span className="status-tag">CrossEncoder</span>
            <span className="status-tag">Local LLM</span>
          </div>
        )}
      </div>
    </div>
  );
}
