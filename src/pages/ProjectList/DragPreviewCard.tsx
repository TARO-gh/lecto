import { FileText, Folder } from 'lucide-react'
import type { DragItemData } from './dnd'

interface Props {
  item: DragItemData
  count?: number
}

export function DragPreviewCard({ item, count }: Props) {
  const isDir = item.kind === 'directory'
  const label = isDir
    ? item.relPath.split('/').at(-1) ?? item.relPath
    : item.folderName.split('/').at(-1) ?? item.folderName

  return (
    <div className="relative flex items-center gap-3 border rounded-lg p-4 bg-background shadow-2xl rotate-1 opacity-90 cursor-grabbing min-w-48 max-w-72">
      {isDir
        ? <Folder size={18} className="shrink-0 text-muted-foreground" />
        : <FileText size={18} className="shrink-0 text-muted-foreground" />
      }
      <p className="font-medium truncate">{label}</p>
      {count && count > 1 && (
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
          {count}
        </span>
      )}
    </div>
  )
}
