import { useEffect, useRef, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { ThemeToggle } from '../../components/ThemeToggle'
import SectionPanel from './SectionPanel'
import TranslationArea from './TranslationArea'
import ChatArea from './ChatArea'
import PdfViewer, { type PdfViewerHandle } from './PdfViewer'
import NoteDrawer from './NoteDrawer'
import type { ProjectMeta, AiPreset } from '../../types/electron'
import type { OutlineItem, RawSection } from '../../types/pdf'
import { buildSectionsFromMarkdownHeadings } from '../../lib/sectionExtractor'

export default function PaperView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const folderName = decodeURIComponent(id ?? '')
  const [project, setProject] = useState<ProjectMeta | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [validatedSections, setValidatedSections] = useState<RawSection[]>([])
  const [selectedSection, setSelectedSection] = useState<RawSection | null>(null)
  const [sectionPanelOpen, setSectionPanelOpen] = useState(() =>
    localStorage.getItem('lecto.sectionPanelOpen') !== 'false'
  )
  const [translationWidth, setTranslationWidth] = useState(() =>
    parseInt(localStorage.getItem('lecto.translationWidth') ?? '320')
  )
  const [chatWidth, setChatWidth] = useState(() =>
    parseInt(localStorage.getItem('lecto.chatWidth') ?? '320')
  )
  const [presets, setPresets] = useState<AiPreset[]>([])
  const [isNoteOpen, setIsNoteOpen] = useState(() =>
    localStorage.getItem('lecto.isNoteOpen') === 'true'
  )
  const [noteHeight, setNoteHeight] = useState(() =>
    parseInt(localStorage.getItem('lecto.noteHeight') ?? '200')
  )

  useEffect(() => { localStorage.setItem('lecto.sectionPanelOpen', String(sectionPanelOpen)) }, [sectionPanelOpen])
  useEffect(() => { localStorage.setItem('lecto.translationWidth', String(translationWidth)) }, [translationWidth])
  useEffect(() => { localStorage.setItem('lecto.chatWidth', String(chatWidth)) }, [chatWidth])
  useEffect(() => { localStorage.setItem('lecto.isNoteOpen', String(isNoteOpen)) }, [isNoteOpen])
  useEffect(() => { localStorage.setItem('lecto.noteHeight', String(noteHeight)) }, [noteHeight])
  const translationPanelRef = useRef<HTMLDivElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)

  const startResize = (
    startX: number,
    startWidth: number,
    panelRef: React.RefObject<HTMLDivElement | null>,
    setter: (w: number) => void
  ) => {
    let currentWidth = startWidth
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      currentWidth = Math.max(180, Math.min(600, startWidth + (startX - e.clientX)))
      if (panelRef.current) panelRef.current.style.width = `${currentWidth}px`
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      setter(currentWidth)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // チャットリサイズ：翻訳幅と逆方向に変化させて翻訳エリアの左端を固定
  const startResizeChat = (startX: number) => {
    const startChatWidth = chatWidth
    const startTransWidth = translationWidth
    let currentChatWidth = startChatWidth
    let currentTransWidth = startTransWidth
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      const delta = startX - e.clientX // 正 = 左ドラッグ = チャット拡大
      currentChatWidth = Math.max(180, Math.min(600, startChatWidth + delta))
      const actualDelta = currentChatWidth - startChatWidth
      currentTransWidth = Math.max(180, Math.min(600, startTransWidth - actualDelta))
      if (chatPanelRef.current) chatPanelRef.current.style.width = `${currentChatWidth}px`
      if (translationPanelRef.current) translationPanelRef.current.style.width = `${currentTransWidth}px`
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      setChatWidth(currentChatWidth)
      setTranslationWidth(currentTransWidth)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleTranslationComplete = (title: string, translation: string, model: string, date: string) => {
    setValidatedSections(prev => {
      const updated = prev.map(s =>
        s.title === title ? { ...s, translation, translationModel: model, translationDate: date } : s
      )
      if (folderName) window.electronAPI.saveSections(folderName, updated)
      return updated
    })
  }
  const pdfViewerRef = useRef<PdfViewerHandle>(null)

  useEffect(() => {
    window.electronAPI.getSettings().then(s => setPresets(s.ai.presets))
  }, [])

  useEffect(() => {
    if (!folderName) return
    window.electronAPI.listProjects().then(projects => {
      const found = projects.find(p => p.folderName === folderName) ?? null
      setProject(found)
    })
    window.electronAPI.getPdfPath(folderName).then(setPdfPath)
    // キャッシュ済みセクションがあれば読み込む
    window.electronAPI.loadSections(folderName).then(cached => {
      if (cached) {
        setValidatedSections(cached)
        setOutline(cached.map(s => ({ title: s.title, pageNumber: s.pageNumber, level: s.level, items: [] })))
      }
    })
  }, [folderName])

  // pdfPathが確定したらセクション抽出（キャッシュがなければ）
  useEffect(() => {
    if (!pdfPath || !folderName) return

    window.electronAPI.loadSections(folderName).then(async cached => {
      if (cached) return

      try {
        const pages = await window.electronAPI.extractPdfMarkdown(pdfPath)
        const sections = buildSectionsFromMarkdownHeadings(pages)
        console.log('[PaperView] sections:', sections.map(s => ({ title: s.title, pageNumber: s.pageNumber })))

        setValidatedSections(sections)
        setOutline(sections.map(s => ({
          title: s.title,
          pageNumber: s.pageNumber,
          level: s.level,
          items: [],
        })))

        if (sections.length > 0) {
          window.electronAPI.saveSections(folderName, sections)
        }
      } catch (e) {
        console.error('Section extraction failed:', e)
      }
    })
  }, [pdfPath, folderName])

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="border-b bg-background px-4 h-12 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
            {t('common.back')}
          </button>
          <span className="text-sm font-medium text-muted-foreground">|</span>
          <span className="text-sm font-medium">{project?.title ?? '...'}</span>
        </div>
        <ThemeToggle />
      </header>

      {/* 4エリアレイアウト */}
      <div className="flex flex-1 overflow-hidden">
        {/* セクションパネル（開いているとき） */}
        {sectionPanelOpen && (
          <div className="w-56 border-r shrink-0 flex flex-col overflow-y-auto">
            <SectionPanel
              outline={outline}
              sections={validatedSections}
              selectedTitle={selectedSection?.title ?? null}
              goToPage={p => pdfViewerRef.current?.goToPage(p)}
              onSectionClick={setSelectedSection}
              onClose={() => setSectionPanelOpen(false)}
            />
          </div>
        )}

        {/* セクションパネルが閉じているとき：開くボタン */}
        {!sectionPanelOpen && (
          <div className="border-r shrink-0 flex items-start pt-3 px-1">
            <button
              onClick={() => setSectionPanelOpen(true)}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
              title="セクションパネルを開く"
            >
              <PanelLeftOpen size={15} />
            </button>
          </div>
        )}

        {/* PDFビューワー + ノートドロワー */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <PdfViewer
              ref={pdfViewerRef}
              pdfPath={pdfPath}
            />
          </div>
          <NoteDrawer
            folderName={folderName}
            isOpen={isNoteOpen}
            onToggle={() => setIsNoteOpen(v => !v)}
            height={noteHeight}
            onHeightChange={setNoteHeight}
          />
        </div>

        {/* リサイズハンドル：PDF | 翻訳 */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors border-l"
          onMouseDown={e => startResize(e.clientX, translationWidth, translationPanelRef, setTranslationWidth)}
        />

        {/* 翻訳エリア */}
        <div ref={translationPanelRef} className="shrink-0 overflow-y-auto" style={{ width: translationWidth }}>
          <TranslationArea
            section={selectedSection}
            presets={presets}
            onTranslationComplete={handleTranslationComplete}
          />
        </div>

        {/* リサイズハンドル：翻訳 | チャット */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors border-l"
          onMouseDown={e => startResizeChat(e.clientX)}
        />

        {/* チャットエリア */}
        <div ref={chatPanelRef} className="shrink-0 overflow-y-auto" style={{ width: chatWidth }}>
          <ChatArea sections={validatedSections} projectTitle={project?.title ?? ''} folderName={folderName ?? ''} presets={presets} />
        </div>
      </div>
    </div>
  )
}
