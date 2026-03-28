import { useTranslation } from 'react-i18next'

interface Props {
  message: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ message, onConfirm, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-sm shadow-lg">
        <p className="text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md border hover:bg-accent transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-4 py-2 rounded-md bg-destructive text-white hover:opacity-90 transition-opacity"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
