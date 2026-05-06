import { useState } from 'react'
import Citations from './Citations'
import { IconCopy, IconRefresh, IconWarning } from './Icons'
import styles from './Message.module.css'

function TypingIndicator() {
  return (
    <div className={styles.assistantRow}>
      <div className={styles.avatar}>⚕</div>
      <div className={styles.typingDots}>
        <span /><span /><span />
      </div>
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className={styles.userRow}>
      <div className={styles.userBubble}>{content}</div>
    </div>
  )
}

function AssistantMessage({ content, sources, onRetry }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  // Render paragraphs — split on double newlines
  const paragraphs = content.split(/\n\n+/).filter(Boolean)

  return (
    <div className={`${styles.assistantRow} ${styles.group}`}>
      <div className={styles.avatar}>⚕</div>
      <div className={styles.assistantContent}>
        <div className={styles.assistantName}>MedRAG</div>
        <div className={styles.body}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p.trim()}</p>
          ))}
          <Citations sources={sources} />
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleCopy}>
            <IconCopy />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {onRetry && (
            <button className={styles.actionBtn} onClick={onRetry}>
              <IconRefresh />
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorMessage({ content, onRetry }) {
  return (
    <div className={styles.errorRow}>
      <div className={styles.errorInner}>
        <IconWarning />
        <span>{content}</span>
        {onRetry && (
          <button className={styles.retryBtn} onClick={onRetry}>Try again</button>
        )}
      </div>
    </div>
  )
}

export { TypingIndicator }

export default function Message({ message, onRetry, isLast }) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} />
  }
  if (message.role === 'error') {
    return <ErrorMessage content={message.content} onRetry={isLast ? onRetry : null} />
  }
  return (
    <AssistantMessage
      content={message.content}
      sources={message.sources}
      onRetry={isLast ? onRetry : null}
    />
  )
}
