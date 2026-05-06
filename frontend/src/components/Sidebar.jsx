import styles from './Sidebar.module.css'
import { IconPlus } from './Icons'

const SUGGESTIONS = [
  'Metformin use in CKD stage 3',
  'SGLT2 inhibitors and cardiovascular outcomes',
  'Statin therapy post-MI evidence',
]

export default function Sidebar({ conversations, activeId, onNew, onSelect }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logoMark}>⚕</div>
        <div>
          <div className={styles.logoText}>
            MedRAG <span>· Medical AI</span>
          </div>
        </div>
      </div>

      <button className={styles.newBtn} onClick={onNew}>
        <IconPlus />
        New consultation
      </button>

      <div className={styles.section}>Recent</div>

      <nav className={styles.historyList}>
        {conversations.length === 0 ? (
          SUGGESTIONS.map((s, i) => (
            <div key={i} className={styles.historyItem} style={{ opacity: 0.45, cursor: 'default' }}>
              {s}
            </div>
          ))
        ) : (
          conversations.map(conv => (
            <div
              key={conv.id}
              className={`${styles.historyItem} ${conv.id === activeId ? styles.active : ''}`}
              onClick={() => onSelect(conv.id)}
              title={conv.title}
            >
              {conv.title}
            </div>
          ))
        )}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>DR</div>
          <div>
            <div className={styles.userName}>Dr. Researcher</div>
            <div className={styles.userRole}>PubMed · Evidence Mode</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
