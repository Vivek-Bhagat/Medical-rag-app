import { useState, useRef, useEffect } from 'react'
import { IconSend, IconDoc } from './Icons'
import styles from './ChatInput.module.css'

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue]       = useState('')
  const textareaRef             = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.box} ${value ? styles.hasContent : ''}`}>
        <div className={styles.top}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder="Ask a clinical question…"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label="Send"
          >
            <IconSend />
          </button>
        </div>
        <div className={styles.bottom}>
          <div className={styles.tools}>
            <span className={`${styles.tool} ${styles.toolActive}`}>
              <IconDoc size={11} />
              PubMed
            </span>
          </div>
          <span className={styles.note}>Not medical advice · Verify all citations</span>
        </div>
      </div>
    </div>
  )
}
