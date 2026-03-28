import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toFolderName } from '../lib/folderName'

interface Props {
  directoryRelPath?: string | null
  onCreated: () => void
  onClose: () => void
}

type Step = 'idle' | 'selected'

export function NewProjectDialog({ directoryRelPath, onCreated, onClose }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('idle')
  const [title, setTitle] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelectFile = async () => {
    const result = await window.electronAPI.selectPdfFile()
    if (!result) return
    setFilePath(result.filePath)
    setTitle(result.fileName)
    setStep('selected')
  }

  const handleCreate = async () => {
    const folderName = toFolderName(title.trim())
    if (!title.trim() || !filePath) return
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.createProject({
        title: title.trim(),
        folderName,
        pdfSrcPath: filePath,
        directoryRelPath: directoryRelPath ?? null,
      })
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{t('projectList.newProject')}</h2>

        {step === 'idle' ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground">{t('projectList.noProjectsHint')}</p>
            <button
              onClick={handleSelectFile}
              className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              PDF を選択
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground truncate">{filePath}</p>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('projectList.projectName')}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
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
                disabled={!title.trim() || loading}
                className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        )}

        {step === 'idle' && (
          <div className="flex justify-end mt-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border hover:bg-accent transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
