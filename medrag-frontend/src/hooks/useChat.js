import { useState, useRef, useCallback } from 'react'
import { queryMedRAG } from '../utils/api'

export function useChat() {
  const [conversations, setConversations] = useState([])   // [{id, title, messages}]
  const [activeId, setActiveId]           = useState(null)
  const [isLoading, setIsLoading]         = useState(false)
  const [error, setError]                 = useState(null)
  const abortRef                          = useRef(null)

  const activeConversation = conversations.find(c => c.id === activeId) || null
  const messages           = activeConversation?.messages || []

  const newConversation = useCallback(() => {
    setActiveId(null)
    setError(null)
  }, [])

  const selectConversation = useCallback((id) => {
    setActiveId(id)
    setError(null)
  }, [])

  const sendMessage = useCallback(async (query) => {
    if (!query.trim() || isLoading) return

    setError(null)

    // user message object
    const userMsg = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: query.trim(),
      ts:      Date.now(),
    }

    // create or update conversation
    let convId = activeId
    if (!convId) {
      convId = crypto.randomUUID()
      const newConv = {
        id:       convId,
        title:    query.trim().slice(0, 60),
        messages: [userMsg],
        ts:       Date.now(),
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(convId)
    } else {
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, messages: [...c.messages, userMsg] }
            : c
        )
      )
    }

    setIsLoading(true)

    // abort any in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const data = await queryMedRAG(query.trim(), abortRef.current.signal)

      const assistantMsg = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content: data.answer || '',
        sources: data.sources || [],
        ts:        Date.now(),
      }

      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, messages: [...c.messages, assistantMsg] }
            : c
        )
      )
    } catch (err) {
      if (err.name === 'AbortError') return

      const errorMsg = {
        id:      crypto.randomUUID(),
        role:    'error',
        content: err.message || 'Something went wrong. Please try again.',
        ts:      Date.now(),
      }
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, messages: [...c.messages, errorMsg] }
            : c
        )
      )
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeId, isLoading])

  const retryLast = useCallback(() => {
    if (!messages.length) return
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUser) return

    // remove last assistant/error message then resend
    setConversations(prev =>
      prev.map(c =>
        c.id === activeId
          ? { ...c, messages: c.messages.filter(m => m.id !== c.messages[c.messages.length - 1].id) }
          : c
      )
    )
    sendMessage(lastUser.content)
  }, [messages, activeId, sendMessage])

  return {
    conversations,
    activeId,
    messages,
    isLoading,
    error,
    sendMessage,
    newConversation,
    selectConversation,
    retryLast,
  }
}
