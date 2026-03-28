import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronDown, ChevronUp, Copy, FileText, Pencil } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'

const noteThemeExtension = EditorView.theme({
  '&': { background: 'transparent !important' },
  '.cm-content': { caretColor: 'hsl(var(--foreground))', userSelect: 'text', WebkitUserSelect: 'text' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '.cm-activeLine': { backgroundColor: 'hsl(var(--accent) / 0.5) !important' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'oklch(0.72 0.12 250 / 0.35) !important',
  },
  '.cm-gutters': { background: 'transparent', border: 'none' },
})
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { normalizeLatex } from '../../lib/utils'

interface Props {
  folderName: string
  isOpen: boolean
  onToggle: () => void
  height: number
  onHeightChange: (h: number) => void
}

export default function NoteDrawer({ folderName, isOpen, onToggle, height, onHeightChange }: Props) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [readMode, setReadMode] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const noteAreaRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ダークモード変化を検知
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // プロジェクトが変わったらノートを読み込む
  useEffect(() => {
    if (!folderName) return
    window.electronAPI.noteLoad(folderName).then(setContent)
  }, [folderName])

  const handleChange = (value: string) => {
    setContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      window.electronAPI.noteSave(folderName, value)
    }, 500)
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    let currentH = startH
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      currentH = Math.max(80, Math.min(600, startH + (startY - ev.clientY)))
      if (noteAreaRef.current) noteAreaRef.current.style.height = `${currentH}px`
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      onHeightChange(currentH)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="shrink-0 border-t flex flex-col">
      {/* リサイズハンドル（開いているときのみ） */}
      {isOpen && (
        <div
          className="h-1 cursor-row-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0"
          onMouseDown={startResize}
        />
      )}

      {/* エディタエリア */}
      {isOpen && (
        <div ref={noteAreaRef} style={{ height }} className="flex flex-col relative overflow-hidden">
          <div className="absolute top-1.5 right-2 z-10 flex items-center gap-0.5">
            <button
              onClick={() => setReadMode(v => !v)}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
              title={readMode ? 'ソースモード' : 'リードモード'}
            >
              {readMode ? <Pencil size={12} /> : <BookOpen size={12} />}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(content)}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
              title="コピー"
            >
              <Copy size={12} />
            </button>
          </div>
          {readMode ? (
            <div className="flex-1 overflow-y-auto px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none leading-relaxed select-text">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(content)}</ReactMarkdown>
            </div>
          ) : (
            <CodeMirror
              value={content}
              onChange={handleChange}
              extensions={[markdown(), noteThemeExtension]}
              theme={isDark ? 'dark' : 'light'}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                highlightSelectionMatches: false,
              }}
              placeholder={t('paperView.notePlaceholder')}
              className="flex-1 overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
              height="100%"
            />
          )}
        </div>
      )}

      {/* タブ（常時表示） */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 select-none"
      >
        <FileText size={12} />
        {t('paperView.note')}
        {isOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </div>
  )
}
