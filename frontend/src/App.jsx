import { useEffect, useRef } from 'react'
import { useChat } from './hooks/useChat'
import Sidebar from './components/Sidebar'
import Welcome from './components/Welcome'
import Message, { TypingIndicator } from './components/Message'
import ChatInput from './components/ChatInput'
import { IconShare } from './components/Icons'
import styles from './App.module.css'

export default function App() {
  const {
    conversations,
    activeId,
    messages,
    isLoading,
    sendMessage,
    newConversation,
    selectConversation,
    retryLast,
  } = useChat()

  const chatEndRef = useRef(null)

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const showWelcome = messages.length === 0 && !isLoading

  return (
    <div className={styles.app}>
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNew={newConversation}
        onSelect={selectConversation}
      />

      {/* Main panel */}
      <div className={styles.main}>

        {/* Top bar */}
        <div className={styles.topbar}>
          <div className={styles.modelPill}>
            <span className={styles.modelDot} />
            MedRAG · Application
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.45 }}>
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.topActions}>
            <button className={styles.iconBtn} title="Share">
              <IconShare size={14} />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className={styles.chatArea}>
          {showWelcome ? (
            <Welcome onSend={sendMessage} />
          ) : (
            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <Message
                  key={msg.id}
                  message={msg}
                  onRetry={retryLast}
                  isLast={i === messages.length - 1}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
