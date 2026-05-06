import styles from './Welcome.module.css'

const SUGGESTIONS = [
  { label: 'Pharmacology', text: 'What is the evidence for metformin use in patients with CKD stage 3?' },
  { label: 'Cardiology',   text: 'Summarize RCTs on SGLT2 inhibitors and cardiovascular outcomes' },
  { label: 'Infectious Disease', text: 'Compare β-lactam monotherapy vs combination therapy for severe CAP' },
  { label: 'Endocrinology', text: 'What HbA1c targets are recommended for older adults with T2DM?' },
]

export default function Welcome({ onSend }) {
  return (
    <div className={styles.welcome}>
      <div className={styles.logoMark}>⚕</div>
      <h1 className={styles.title}>Evidence-based medical intelligence</h1>
      <p className={styles.subtitle}>
        Ask clinical questions and receive answers grounded in PubMed literature,
        with full citations for every claim.
      </p>
      <div className={styles.grid}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className={styles.card} onClick={() => onSend(s.text)}>
            <div className={styles.cardLabel}>{s.label}</div>
            <div className={styles.cardText}>{s.text}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
