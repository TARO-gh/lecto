import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDroppable } from '@dnd-kit/core'
import type { DropZoneData } from './dnd'

interface BreadcrumbItem {
  name: string
  relPath: string | null
}

interface Props {
  path: BreadcrumbItem[]
  isDragging: boolean
  isSearching: boolean
  onNavigate: (relPath: string | null) => void
}

function DroppableSegment({
  item,
  label,
  isLast,
  onNavigate,
}: {
  item: BreadcrumbItem
  label: string
  isLast: boolean
  onNavigate: () => void
}) {
  const data: DropZoneData = item.relPath === null
    ? { kind: 'root' }
    : { kind: 'directory', relPath: item.relPath }
  const id = item.relPath === null ? 'root' : `dir::${item.relPath}`

  const { setNodeRef, isOver } = useDroppable({ id, data })

  return (
    <span
      ref={setNodeRef}
      onClick={onNavigate}
      className={`cursor-pointer rounded px-1 py-0.5 transition-colors ${
        isOver
          ? 'bg-primary/20 text-primary font-semibold'
          : isLast
            ? 'text-foreground font-medium'
            : 'hover:text-foreground'
      }`}
    >
      {label}
    </span>
  )
}

export function Breadcrumb({ path, isDragging, isSearching, onNavigate }: Props) {
  const { t } = useTranslation()

  const displayPath = isSearching ? [path[0]] : path

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap select-none">
      {displayPath.map((item, i) => {
        const isLast = i === path.length - 1
        const label = item.relPath === null ? t('projectList.vault') : item.name

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="shrink-0" />}
            {isDragging ? (
              <DroppableSegment
                item={item}
                label={label}
                isLast={isLast}
                onNavigate={() => onNavigate(item.relPath)}
              />
            ) : isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <button
                onClick={() => onNavigate(item.relPath)}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
