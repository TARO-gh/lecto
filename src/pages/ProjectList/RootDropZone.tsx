import { useDroppable } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'

export function RootDropZone() {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
    data: { kind: 'root' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`col-span-full border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors ${
        isOver
          ? 'bg-primary/10 border-primary text-primary'
          : 'border-muted-foreground/30 text-muted-foreground'
      }`}
    >
      {t('projectList.dropToRoot')}
    </div>
  )
}
