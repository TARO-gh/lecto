import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { normalizeLatex } from '../../lib/utils'
import type { AiPreset } from '../../types/electron'
import type { RawSection } from '../../types/pdf'

interface Props {
  section: RawSection | null
  presets: AiPreset[]
  onTranslationComplete: (title: string, translation: string, model: string, date: string) => void
}

export default function TranslationArea({ section, presets, onTranslationComplete }: Props) {
  const { t } = useTranslation()
  const [result, setResult] = useState('')
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [translationLanguage, setTranslationLanguage] = useState('ja')
  const [meta, setMeta] = useState<{ model: string; date: string } | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const resultRef = useRef('')

  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setTranslationLanguage(s.translationLanguage)
    })
  }, [])

  // presetsが変わったらデフォルトプリセットをセット
  useEffect(() => {
    const def = presets.find(p => p.isDefault) ?? presets[0]
    if (def) setSelectedPresetId(def.id)
  }, [presets])

  // セクションが変わったらキャッシュ済み翻訳を表示（なければリセット）
  useEffect(() => {
    const cached = section?.translation ?? ''
    setResult(cached)
    setError(null)
    setWarning(null)
    setMeta(section?.translationModel && section?.translationDate
      ? { model: section.translationModel, date: section.translationDate }
      : null
    )
  }, [section])

  const handleTranslate = () => {
    if (!section?.content) return

    setTranslating(true)
    setError(null)
    setWarning(null)
    setResult('')
    setMeta(null)
    resultRef.current = ''

    window.electronAPI.aiTranslate(
      { text: section.content, targetLanguage: translationLanguage, presetId: selectedPresetId },
      (chunk) => {
        resultRef.current += chunk
        setResult(resultRef.current)
      },
      (err, model) => {
        setTranslating(false)
        if (err === 'length_limit') {
          const date = new Date().toISOString()
          const resolvedModel = model ?? ''
          setMeta({ model: resolvedModel, date })
          setWarning(t('paperView.errorLengthLimit'))
          onTranslationComplete(section.title, resultRef.current, resolvedModel, date)
        } else if (err) {
          const msgMap: Record<string, string> = {
            connection_error:  t('paperView.errorConnection'),
            auth_error:        t('paperView.errorAuth'),
            rate_limit:        t('paperView.errorRateLimit'),
            context_overflow:  t('paperView.errorInputTooLong'),
            unknown_error:     t('paperView.errorUnknown'),
          }
          setError(msgMap[err] ?? err)
        } else {
          const date = new Date().toISOString()
          const resolvedModel = model ?? ''
          setMeta({ model: resolvedModel, date })
          onTranslationComplete(section.title, resultRef.current, resolvedModel, date)
        }
      }
    )
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <div className="p-4 h-full flex flex-col select-none">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
          {t('paperView.translation')}
        </p>
        <div className="flex items-center gap-1">
          {presets.length > 0 && (
            <select
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              className="text-xs border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring max-w-32 truncate"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleTranslate}
            disabled={translating || !section}
            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {translating ? t('paperView.translating') : t('paperView.translate')}
          </button>
        </div>
      </div>

      {section && (
        <p className="text-xs text-muted-foreground mb-1 truncate" title={section.title}>
          {section.title}
        </p>
      )}

      {meta && (
        <p className="text-xs text-muted-foreground mb-2 opacity-60">
          {meta.model} · {formatDate(meta.date)}
        </p>
      )}

      {warning && (
        <p className="text-xs text-amber-500 mb-2">{warning}</p>
      )}

      <div className="flex-1 overflow-y-auto text-sm select-text">
        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : result ? (
          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(result)}</ReactMarkdown>
          </div>
        ) : section ? (
          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(section.content || '（コンテンツなし）')}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">{t('paperView.selectSection')}</p>
        )}
      </div>
    </div>
  )
}
