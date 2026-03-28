import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  parentRelPath: string | null
  onCreated: () => void
  onClose: () => void
}

export function NewDirectoryDialog({ parentRelPath, onCreated, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.createDirectory({ name: trimmed, parentRelPath })
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{t('projectList.newDirectory')}</h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('projectList.directoryName')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border hover:bg-accent transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
