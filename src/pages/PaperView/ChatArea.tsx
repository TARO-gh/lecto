import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, History, Pencil, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { normalizeLatex } from '../../lib/utils'
import type { Chat, ChatMeta, ChatMessage, AiPreset } from '../../types/electron'
import type { RawSection } from '../../types/pdf'
import { ConfirmDialog } from '../../components/ConfirmDialog'

interface Props {
  sections: RawSection[]
  projectTitle: string
  folderName: string
  presets: AiPreset[]
}

export default function ChatArea({ sections, projectTitle, folderName, presets }: Props) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [checkedTitles, setCheckedTitles] = useState<Set<string>>(new Set())
  const [chatHistory, setChatHistory] = useState<ChatMeta[]>([])
  const [contextSections, setContextSections] = useState<string[]>([])

  const [toast, setToast] = useState<string | null>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [deletingMsgIndex, setDeletingMsgIndex] = useState<number | null>(null)
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const streamingRef = useRef('')
  const abortRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<Chat | null>(null)
  const contextRef = useRef<string>('')

  const startNewChat = (context: string, contextSections: string[] = []) => {
    const now = new Date()
    chatRef.current = {
      id: String(Date.now()),
      title: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      contextSections,
      messages: [],
    }
    contextRef.current = context
    setContextSections(contextSections)
    setMessages([])
    setInput('')
    setHistoryOpen(false)
    setSelecting(false)
  }

  // presetsが変わったらデフォルトプリセットをセット
  useEffect(() => {
    const def = presets.find(p => p.isDefault) ?? presets[0]
    if (def) setSelectedPresetId(def.id)
  }, [presets])

  // プロジェクトを開いたらコンテキストなしで新規チャット
  useEffect(() => {
    startNewChat('')
  }, [folderName])

  const openSectionPicker = () => {
    setCheckedTitles(new Set(contextSections))
    setHistoryOpen(false)
    setSelecting(true)
  }

  const toggleSection = (title: string) => {
    setCheckedTitles(prev => {
      const next = new Set(prev)
      next.has(title) ? next.delete(title) : next.add(title)
      return next
    })
  }

  const buildContext = (sectionTitles: string[]) => {
    const selected = sections.filter(s => sectionTitles.includes(s.title))
    const parts: string[] = []
    if (projectTitle) parts.push(`論文タイトル: ${projectTitle}`)
    for (const s of selected) {
      parts.push(`## ${s.title}\n\n${s.content}`)
    }
    return parts.join('\n\n')
  }

  const applyContext = (titles: string[]) => {
    contextRef.current = buildContext(titles)
    setContextSections(titles)
    if (chatRef.current) chatRef.current = { ...chatRef.current, contextSections: titles }
    setSelecting(false)
  }

  const buildTitle = (chat: Chat, msgs: ChatMessage[]) => {
    if (chat.title) return chat.title
    const firstUser = msgs.find(m => m.role === 'user')
    if (!firstUser) return ''
    const d = new Date(chat.createdAt)
    const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    const snippet = firstUser.content.slice(0, 20) + (firstUser.content.length > 20 ? '...' : '')
    return `${dateStr} · ${snippet}`
  }

  const saveChat = (msgs: ChatMessage[]) => {
    const chat = chatRef.current
    if (!chat || msgs.length === 0) return
    const title = buildTitle(chat, msgs)
    const updated: Chat = { ...chat, title, updatedAt: new Date().toISOString(), messages: msgs }
    chatRef.current = updated
    window.electronAPI.saveChat(folderName, updated)
  }

  const openHistory = async () => {
    const list = await window.electronAPI.listChats(folderName)
    setChatHistory(list)
    setSelecting(false)
    setHistoryOpen(true)
  }

  const loadChat = async (chatId: string) => {
    const chat = await window.electronAPI.loadChat(folderName, chatId)
    if (!chat) return
    chatRef.current = chat
    contextRef.current = chat.contextSections ? buildContext(chat.contextSections) : ''
    setContextSections(chat.contextSections ?? [])
    setMessages(chat.messages)
    setHistoryOpen(false)
  }

  const confirmDeleteChat = async () => {
    if (!deletingChatId) return
    await window.electronAPI.deleteChat(folderName, deletingChatId)
    setChatHistory(prev => prev.filter(c => c.id !== deletingChatId))
    setDeletingChatId(null)
  }

  const handleCopyMsg = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleRegenerate = (index: number) => {
    const userMsg = messages[index - 1]
    if (!userMsg || userMsg.role !== 'user' || loading) return

    const baseMessages = messages.slice(0, index - 1)
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', createdAt: new Date().toISOString() }
    const newMessages = [...baseMessages, userMsg]
    setMessages([...newMessages, assistantMsg])
    setLoading(true)
    streamingRef.current = ''

    saveChat(newMessages)

    abortRef.current = window.electronAPI.aiChat(
      { messages: newMessages.map(m => ({ role: m.role, content: m.content })), context: contextRef.current, presetId: selectedPresetId },
      (chunk) => {
        streamingRef.current += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: streamingRef.current }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      (err) => {
        abortRef.current = null
        setLoading(false)
        setMessages(prev => {
          const updated = [...prev]
          if (err) {
            const msgMap: Record<string, string> = {
              context_overflow:  t('paperView.errorContextOverflow'),
              connection_error:  t('paperView.errorConnection'),
              auth_error:        t('paperView.errorAuth'),
              rate_limit:        t('paperView.errorRateLimit'),
              length_limit:      t('paperView.errorLengthLimit'),
              unknown_error:     t('paperView.errorUnknown'),
            }
            const message = msgMap[err] ?? err
            if (err === 'context_overflow') {
              updated.splice(updated.length - 1, 1)
            } else {
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: '' }
            }
            setToast(message)
            setTimeout(() => setToast(null), 5000)
          }
          saveChat(updated)
          return updated
        })
      }
    )
  }

  const confirmDeleteMsg = () => {
    if (deletingMsgIndex === null) return
    setMessages(prev => {
      const updated = prev.filter((_, i) => i !== deletingMsgIndex)
      saveChat(updated)
      return updated
    })
    setDeletingMsgIndex(null)
  }

  const handleEditSubmit = (index: number) => {
    const trimmed = editingContent.trim()
    if (!trimmed || loading) return

    const editedUserMsg: ChatMessage = { ...messages[index], content: trimmed }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', createdAt: new Date().toISOString() }
    const newMessages = [...messages.slice(0, index), editedUserMsg]

    setEditingMsgIndex(null)
    setEditingContent('')
    setMessages([...newMessages, assistantMsg])
    setLoading(true)
    streamingRef.current = ''

    saveChat(newMessages)

    abortRef.current = window.electronAPI.aiChat(
      { messages: newMessages.map(m => ({ role: m.role, content: m.content })), context: contextRef.current, presetId: selectedPresetId },
      (chunk) => {
        streamingRef.current += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: streamingRef.current }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      (err) => {
        abortRef.current = null
        setLoading(false)
        setMessages(prev => {
          const updated = [...prev]
          if (err) {
            const msgMap: Record<string, string> = {
              context_overflow:  t('paperView.errorContextOverflow'),
              connection_error:  t('paperView.errorConnection'),
              auth_error:        t('paperView.errorAuth'),
              rate_limit:        t('paperView.errorRateLimit'),
              length_limit:      t('paperView.errorLengthLimit'),
              unknown_error:     t('paperView.errorUnknown'),
            }
            const message = msgMap[err] ?? err
            if (err === 'context_overflow') {
              updated.splice(updated.length - 1, 1)
            } else {
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: '' }
            }
            setToast(message)
            setTimeout(() => setToast(null), 5000)
          }
          saveChat(updated)
          return updated
        })
      }
    )
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text, createdAt: new Date().toISOString() }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', createdAt: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages([...newMessages, assistantMsg])
    setInput('')
    setLoading(true)
    streamingRef.current = ''

    saveChat(newMessages)

    abortRef.current = window.electronAPI.aiChat(
      { messages: newMessages.map(m => ({ role: m.role, content: m.content })), context: contextRef.current, presetId: selectedPresetId },
      (chunk) => {
        streamingRef.current += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: streamingRef.current }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      (err) => {
        abortRef.current = null
        setLoading(false)
        setMessages(prev => {
          const updated = [...prev]
          if (err) {
            const msgMap: Record<string, string> = {
              context_overflow:  t('paperView.errorContextOverflow'),
              connection_error:  t('paperView.errorConnection'),
              auth_error:        t('paperView.errorAuth'),
              rate_limit:        t('paperView.errorRateLimit'),
              length_limit:      t('paperView.errorLengthLimit'),
              unknown_error:     t('paperView.errorUnknown'),
            }
            const message = msgMap[err] ?? err
            if (err === 'context_overflow') {
              updated.splice(updated.length - 1, 1)
            } else {
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: '' }
            }
            setToast(message)
            setTimeout(() => setToast(null), 5000)
          }
          saveChat(updated)
          return updated
        })
      }
    )
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
    } catch { return iso }
  }

  return (
    <div className="p-4 h-full flex flex-col relative select-none">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('paperView.chat')}
        </p>

        <div className="flex items-center gap-1">
          {presets.length > 0 && (
            <select
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              className="text-xs border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring max-w-28 truncate"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => startNewChat('')}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            title="新規チャット"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={openHistory}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            title="チャット履歴"
          >
            <History size={14} />
          </button>
        </div>
      </div>

      {/* セクション選択パネル */}
      {selecting && (
        <div className="absolute inset-x-0 top-10 bottom-16 mx-4 bg-background border rounded-md shadow-lg z-10 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">コンテキスト選択</span>
            <button onClick={() => setSelecting(false)} className="p-0.5 rounded hover:bg-accent">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">セクションがありません</p>
            ) : (
              <>
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer border-b">
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={checkedTitles.size === sections.length}
                    onChange={e => setCheckedTitles(e.target.checked ? new Set(sections.map(s => s.title)) : new Set())}
                  />
                  <span className="text-xs font-semibold">ALL</span>
                </label>
                {sections.map(s => (
                  <label
                    key={s.title}
                    className="flex items-start gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={checkedTitles.has(s.title)}
                      onChange={() => toggleSection(s.title)}
                    />
                    <span className="text-xs">{s.title}</span>
                  </label>
                ))}
              </>
            )}
          </div>
          <div className="flex gap-2 p-2 border-t shrink-0">
            <button
              onClick={() => applyContext([])}
              className="flex-1 text-xs px-2 py-1.5 rounded border hover:bg-accent transition-colors"
            >
              クリア
            </button>
            <button
              onClick={() => applyContext([...checkedTitles])}
              disabled={checkedTitles.size === 0}
              className="flex-1 text-xs bg-primary text-primary-foreground px-2 py-1.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              選択 ({checkedTitles.size})
            </button>
          </div>
        </div>
      )}

      {/* 履歴パネル */}
      {historyOpen && (
        <div className="absolute inset-x-0 top-10 bottom-16 mx-4 bg-background border rounded-md shadow-lg z-10 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">履歴</span>
            <button onClick={() => setHistoryOpen(false)} className="p-0.5 rounded hover:bg-accent">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chatHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">履歴がありません</p>
            ) : (
              chatHistory.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className="flex items-start justify-between px-3 py-2 hover:bg-accent cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setDeletingChatId(chat.id) }}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 mt-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2 select-text">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('paperView.chatEmpty')}</p>
        ) : (
          messages.map((msg, i) => {
            const isStreaming = loading && i === messages.length - 1 && msg.role === 'assistant'
            const isUser = msg.role === 'user'
            return (
              <div key={i} className="group">
                {isUser && editingMsgIndex === i ? (
                  <div className="ml-4">
                    <textarea
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(i) } }}
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-1 mt-1 justify-end">
                      <button
                        onClick={() => { setEditingMsgIndex(null); setEditingContent('') }}
                        className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => handleEditSubmit(i)}
                        disabled={!editingContent.trim()}
                        className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {t('paperView.send')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`text-sm rounded-md px-3 py-2 ${
                        isUser ? 'bg-primary text-primary-foreground ml-4' : 'bg-muted mr-4'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        msg.content.trimStart() ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(msg.content.trimStart())}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="leading-relaxed">{isStreaming ? '...' : ''}</p>
                        )
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                    <div className={`flex gap-0.5 mt-0.5 ${isUser ? 'justify-end mr-4 opacity-0 group-hover:opacity-100 transition-opacity' : 'justify-start'}`}>
                      {isUser ? (
                        <button
                          onClick={() => { setEditingMsgIndex(i); setEditingContent(msg.content) }}
                          disabled={loading}
                          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground disabled:opacity-30"
                          title="編集"
                        >
                          <Pencil size={11} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegenerate(i)}
                          disabled={isStreaming || loading}
                          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground disabled:opacity-30"
                          title="再生成"
                        >
                          <RefreshCw size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopyMsg(msg.content)}
                        disabled={isStreaming}
                        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground disabled:opacity-30"
                        title="コピー"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => setDeletingMsgIndex(i)}
                        disabled={isStreaming}
                        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground disabled:opacity-30"
                        title="削除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* トースト通知 */}
      {toast && (
        <div className="absolute bottom-20 inset-x-4 bg-destructive text-destructive-foreground text-xs rounded-md px-3 py-2 shadow-lg z-30">
          {toast}
        </div>
      )}

      {/* チャット削除確認ダイアログ */}
      {deletingChatId && (
        <ConfirmDialog
          message="このチャット履歴を削除しますか？"
          onConfirm={confirmDeleteChat}
          onClose={() => setDeletingChatId(null)}
        />
      )}

      {/* メッセージ削除確認ダイアログ */}
      {deletingMsgIndex !== null && (
        <ConfirmDialog
          message="このメッセージを削除しますか？"
          onConfirm={confirmDeleteMsg}
          onClose={() => setDeletingMsgIndex(null)}
        />
      )}

      {/* 入力欄 */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={openSectionPicker}
          className="relative p-2 rounded border hover:bg-accent transition-colors text-muted-foreground shrink-0 text-xs font-bold"
          title="コンテキストを選択"
        >
          C
          {contextSections.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {contextSections.length}
            </span>
          )}
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={t('paperView.chatPlaceholder')}
          disabled={loading}
          className="flex-1 text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        {loading ? (
          <button
            onClick={() => { abortRef.current?.(); abortRef.current = null }}
            className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
            title="停止"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t('paperView.send')}
          </button>
        )}
      </div>
    </div>
  )
}
