import { useState } from 'react'
import { IconDoc, IconExternal } from './Icons'
import styles from './Citations.module.css'

function ScoreBar({ score }) {
  const pct   = Math.round(score * 100)
  const level = pct >= 90 ? 'high' : pct >= 55 ? 'mid' : 'low'
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreLabel}>Relevance</span>
      <div className={styles.scoreTrack}>
        <div
          className={`${styles.scoreFill} ${styles[level]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${styles.scorePct} ${styles[level]}`}>{pct}%</span>
    </div>
  )
}

function CitationItem({ source, index }) {
  const [expanded, setExpanded] = useState(false)

  const hasScore    = source.score !== null && source.score !== undefined
  const hasAbstract = !!source.abstract
  const meta        = [source.authors, source.journal, source.year]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={styles.item}>
      <span className={styles.num}>{index}</span>

      <div className={styles.info}>
        <div className={styles.titleRow}>
          {source.url ? (
            <a
              className={styles.title}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.title}
              <IconExternal size={10} />
            </a>
          ) : (
            <span className={styles.title}>{source.title}</span>
          )}
        </div>

        {/* {hasScore && <ScoreBar score={source.score} />} */}

        {meta && <div className={styles.meta}>{meta}</div>}

        {hasAbstract && (
          <>
            <button
              className={styles.abstractToggle}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'Hide abstract ↑' : 'Show abstract ↓'}
            </button>
            {expanded && (
              <div className={styles.abstract}>{source.abstract}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Citations({ sources }) {
  if (!sources || sources.length === 0) return null

  const hasScores = sources.some(s => s.score !== null && s.score !== undefined)

  return (
    <div className={styles.block}>
      <div className={styles.label}>
        <IconDoc size={12} />
        PubMed Sources ({sources.length})
        {hasScores && (
          <span className={styles.labelNote}>· with relevance scores</span>
        )}
      </div>
      {sources.map((source, i) => (
        <CitationItem key={i} source={source} index={source.id ?? i + 1} />
      ))}
    </div>
  )
}
