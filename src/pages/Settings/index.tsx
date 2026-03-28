import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import i18n from '../../i18n'
import type { AppSettings, AiPreset } from '../../types/electron'

const LANGUAGES = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const TRANSLATION_LANGUAGES = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    presets: [
      { id: 'default', name: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o', isDefault: true },
    ],
  },
  language: 'ja',
  translationLanguage: 'ja',
}

function newPresetId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function PresetRow({
  preset,
  canDelete,
  onChange,
  onSetDefault,
  onDelete,
}: {
  preset: AiPreset
  canDelete: boolean
  onChange: (p: AiPreset) => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="border rounded-md overflow-hidden">
      {/* ヘッダー行 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex-1 text-sm font-medium truncate">{preset.name || '（名前なし）'}</span>
        {preset.isDefault && (
          <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            {t('settings.presetDefault')}
          </span>
        )}
        {open ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
      </div>

      {/* 編集フォーム */}
      {open && (
        <div className="border-t px-3 py-3 space-y-3 bg-background">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('settings.presetName')}</label>
            <input
              type="text"
              value={preset.name}
              onChange={e => onChange({ ...preset, name: e.target.value })}
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('settings.baseUrl')}</label>
            <input
              type="text"
              value={preset.baseUrl}
              onChange={e => onChange({ ...preset, baseUrl: e.target.value })}
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('settings.apiKey')}</label>
            <input
              type="password"
              value={preset.apiKey}
              onChange={e => onChange({ ...preset, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{t('settings.apiKeyWarning')}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('settings.model')}</label>
            <input
              type="text"
              value={preset.model}
              onChange={e => onChange({ ...preset, model: e.target.value })}
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            {!preset.isDefault && (
              <button
                onClick={onSetDefault}
                className="text-xs px-3 py-1.5 border rounded-md hover:bg-accent transition-colors"
              >
                {t('settings.presetSetDefault')}
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="text-xs px-3 py-1.5 border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors ml-auto flex items-center gap-1"
              >
                <Trash2 size={12} />
                {t('settings.deletePreset')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [noVault, setNoVault] = useState(false)

  useEffect(() => {
    window.electronAPI.getVaultPath().then(vault => {
      if (!vault) { setNoVault(true); return }
      window.electronAPI.getSettings().then(s => {
        setSettings(s)
        localStorage.setItem('language', s.language)
        i18n.changeLanguage(s.language)
      })
    })
  }, [])

  const updatePreset = (id: string, updated: AiPreset) => {
    setSettings(s => ({
      ...s,
      ai: { presets: s.ai.presets.map(p => p.id === id ? updated : p) },
    }))
  }

  const setDefault = (id: string) => {
    setSettings(s => ({
      ...s,
      ai: { presets: s.ai.presets.map(p => ({ ...p, isDefault: p.id === id })) },
    }))
  }

  const addPreset = () => {
    const newPreset: AiPreset = {
      id: newPresetId(),
      name: 'New Preset',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o',
      isDefault: false,
    }
    setSettings(s => ({ ...s, ai: { presets: [...s.ai.presets, newPreset] } }))
  }

  const deletePreset = (id: string) => {
    setSettings(s => {
      const remaining = s.ai.presets.filter(p => p.id !== id)
      // 削除したものがデフォルトなら先頭をデフォルトに
      if (!remaining.some(p => p.isDefault)) remaining[0].isDefault = true
      return { ...s, ai: { presets: remaining } }
    })
  }

  const handleLanguageChange = (value: string) => {
    setSettings(s => ({ ...s, language: value }))
    localStorage.setItem('language', value)
    i18n.changeLanguage(value)
  }

  const handleSave = async () => {
    await window.electronAPI.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (noVault) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">Vaultを先に選択してください。</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 select-none [&_input]:select-text [&_textarea]:select-text">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>

      {/* AIプリセット */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold border-b pb-2">{t('settings.aiPresets')}</h2>
        <div className="space-y-2">
          {settings.ai.presets.map(preset => (
            <PresetRow
              key={preset.id}
              preset={preset}
              canDelete={settings.ai.presets.length > 1}
              onChange={updated => updatePreset(preset.id, updated)}
              onSetDefault={() => setDefault(preset.id)}
              onDelete={() => deletePreset(preset.id)}
            />
          ))}
        </div>
        <button
          onClick={addPreset}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={14} />
          {t('settings.addPreset')}
        </button>
      </section>

      {/* 言語設定 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold border-b pb-2">{t('settings.translation')}</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('settings.language')}</label>
          <select
            value={settings.language}
            onChange={e => handleLanguageChange(e.target.value)}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('settings.translationLanguage')}</label>
          <select
            value={settings.translationLanguage}
            onChange={e => setSettings(s => ({ ...s, translationLanguage: e.target.value }))}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TRANSLATION_LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          {t('common.save')}
        </button>
        {saved && <span className="text-sm text-muted-foreground">{t('settings.saved')}</span>}
      </div>
    </div>
  )
}
