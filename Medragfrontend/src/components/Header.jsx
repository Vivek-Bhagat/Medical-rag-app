export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-icon">⚕</span>
          <div className="logo-text">
            <h1>MedRAG</h1>
            <p>Evidence-Based Medical Intelligence</p>
          </div>
        </div>
        <div className="header-badge">
          <span className="badge-dot" />
          PubMed · FAISS · CrossEncoder · Local LLM
        </div>
      </div>
    </header>
  );
}
