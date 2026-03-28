import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { webFrame } = (window as any).require('electron')
  webFrame.setVisualZoomLevelLimits(1, 1)
} catch {}

export interface PdfViewerHandle {
  goToPage: (page: number) => void
}

interface Props {
  pdfPath: string | null
}

const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer({ pdfPath }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([])
  const pageTextLayersRef = useRef<(HTMLDivElement | null)[]>([])
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const scaleRef = useRef(1.0)
  const renderGenRef = useRef(0)
  const pendingScrollRef = useRef<{ mouseX: number; ratio: number } | null>(null)

  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const [zoomInput, setZoomInput] = useState('')

  useImperativeHandle(ref, () => ({
    goToPage: (pageNum: number) => {
      pageCanvasesRef.current[pageNum - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  }))

  // PDF読み込み
  useEffect(() => {
    if (!pdfPath) return
    setLoading(true)
    setPdfReady(false)
    setTotalPages(0)
    window.electronAPI.readPdfFile(pdfPath).then(async buffer => {
      const pdf = await pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: './cmaps/',
        cMapPacked: true,
      }).promise
      pdfDocRef.current = pdf
      setTotalPages(pdf.numPages)
      setCurrentPage(1)
      setLoading(false)
      setPdfReady(true)
    }).catch(() => setLoading(false))
  }, [pdfPath])

  // 全ページ描画（PDF読み込み時 or スケール変更時）
  useEffect(() => {
    const pdf = pdfDocRef.current
    if (!pdf || !pdfReady) return

    const gen = ++renderGenRef.current
    scaleRef.current = scale

    const renderAll = async () => {
      for (let i = 0; i < pdf.numPages; i++) {
        if (gen !== renderGenRef.current) break
        const canvas = pageCanvasesRef.current[i]
        if (!canvas) continue
        const page = await pdf.getPage(i + 1)
        if (gen !== renderGenRef.current) break
        const dpr = window.devicePixelRatio || 1
        const MIN_RENDER_SCALE = 2.0
        const renderScale = Math.max(scaleRef.current, MIN_RENDER_SCALE) * dpr
        const viewport = page.getViewport({ scale: renderScale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        // CSSサイズは表示スケールに基づいて設定（オーバーサンプリング→ダウンスケールで高品質描画）
        canvas.style.width = `${viewport.width / renderScale * scaleRef.current}px`
        canvas.style.height = `${viewport.height / renderScale * scaleRef.current}px`
        const ctx = canvas.getContext('2d')!
        try {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
        } catch { /* キャンセル */ }

        if (gen !== renderGenRef.current) break

        // テキストレイヤー
        const textLayerDiv = pageTextLayersRef.current[i]
        if (textLayerDiv) {
          textLayerDiv.innerHTML = ''
          const displayViewport = page.getViewport({ scale: scaleRef.current })
          textLayerDiv.style.setProperty('--total-scale-factor', String(scaleRef.current))
          if (gen !== renderGenRef.current) break
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerDiv,
            viewport: displayViewport,
          })
          try {
            await textLayer.render()
          } catch { /* キャンセル */ }
        }
      }
    }

    renderAll()
  }, [scale, pdfReady])

  // IntersectionObserver で現在ページを追跡
  useEffect(() => {
    if (totalPages === 0) return
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(entries => {
      let best = { page: 1, ratio: 0 }
      entries.forEach(entry => {
        const page = parseInt(entry.target.getAttribute('data-page') ?? '1')
        if (entry.intersectionRatio > best.ratio) {
          best = { page, ratio: entry.intersectionRatio }
        }
      })
      if (best.ratio > 0) setCurrentPage(best.page)
    }, {
      root: container,
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    })

    pageCanvasesRef.current.forEach(canvas => {
      if (canvas) observer.observe(canvas)
    })

    return () => observer.disconnect()
  }, [totalPages, pdfReady])

  // Ctrl+ホイールでズーム
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const mouseX = e.clientX - container.getBoundingClientRect().left
      const oldScale = scaleRef.current
      const newScale = Math.min(4, Math.max(0.5, oldScale - e.deltaY * 0.001))
      scaleRef.current = newScale
      pendingScrollRef.current = { mouseX, ratio: newScale / oldScale }
      setScale(newScale)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  // ズーム時にマウス位置を中心にスクロール補正
  useEffect(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    pendingScrollRef.current = null
    const container = containerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      container.scrollLeft = (container.scrollLeft + pending.mouseX) * pending.ratio - pending.mouseX
    })
  }, [scale])

  // スクロールで currentPage が変わったら input にも反映
  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  // scale が変わったら zoomInput にも反映
  useEffect(() => {
    setZoomInput(String(Math.round(scale * 100)))
  }, [scale])

  const commitZoomInput = () => {
    const n = parseInt(zoomInput)
    if (!isNaN(n)) setScale(Math.min(400, Math.max(50, n)) / 100)
    else setZoomInput(String(Math.round(scale * 100)))
  }

  const changeZoom = (delta: number) => {
    setScale(s => Math.min(4, Math.max(0.5, Math.round((s + delta) * 10) / 10)))
  }

  const goToPage = (pageNum: number) => {
    pageCanvasesRef.current[pageNum - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const commitPageInput = () => {
    const n = parseInt(pageInput)
    if (!isNaN(n)) goToPage(Math.min(totalPages, Math.max(1, n)))
    else setPageInput(String(currentPage))
  }

  return (
    <div className="h-full flex flex-col">
      {/* ナビゲーション */}
      <div className="flex items-center py-2 border-b shrink-0 select-none [&_input]:select-text">
        <div className="flex-1 flex items-center justify-center gap-3">
        <button
          onClick={() => goToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="text"
          className="w-10 text-sm text-center border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
          value={pageInput}
          disabled={totalPages === 0}
          onChange={e => setPageInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { commitPageInput(); (e.target as HTMLInputElement).blur() }
            else if (e.key === 'Escape') { setPageInput(String(currentPage)); (e.target as HTMLInputElement).blur() }
          }}
          onFocus={e => e.target.select()}
          onBlur={commitPageInput}
        />
        <span className="text-sm text-muted-foreground">/ {totalPages > 0 ? totalPages : '-'}</span>
        <button
          onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        {totalPages > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => changeZoom(-0.1)}
              disabled={scale <= 0.5}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <Minus size={13} />
            </button>
            <input
              type="text"
              className="w-12 text-xs text-center border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={zoomInput}
              onChange={e => setZoomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitZoomInput(); (e.target as HTMLInputElement).blur() }
                else if (e.key === 'Escape') { setZoomInput(String(Math.round(scale * 100))); (e.target as HTMLInputElement).blur() }
              }}
              onFocus={e => e.target.select()}
              onBlur={commitZoomInput}
            />
            <span className="text-xs text-muted-foreground">%</span>
            <button
              onClick={() => changeZoom(0.1)}
              disabled={scale >= 4}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
        </div>
      </div>

      {/* ページ一覧 */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {loading && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            読み込み中...
          </div>
        )}
        {!pdfPath && !loading && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            PDFが読み込まれていません
          </div>
        )}
        {totalPages > 0 && Array.from({ length: totalPages }, (_, i) => (
          <div key={i} className="flex justify-center py-3 min-w-fit">
            <div className="relative shadow-md">
              <canvas
                ref={el => { pageCanvasesRef.current[i] = el }}
                data-page={i + 1}
              />
              <div
                ref={el => { pageTextLayersRef.current[i] = el }}
                className="textLayer"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default PdfViewer
