import React from 'react'
import { Folder } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCombinedRefs } from '@dnd-kit/utilities'
import type { DirectoryMeta } from '../../types/electron'
import { ItemContextMenu } from './ItemContextMenu'
import { dragId, dropId } from './dnd'

interface Props {
  directory: DirectoryMeta
  parentRelPath: string | null
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onOpen: () => void
  onRename: () => void
  onTrash: () => void
}

export function DirectoryCard({ directory, parentRelPath, isSelected, onSelect, onOpen, onRename, onTrash }: Props) {
  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({
    id: dragId({ kind: 'directory', relPath: directory.relPath, parentRelPath }),
    data: { kind: 'directory', relPath: directory.relPath, parentRelPath },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId({ kind: 'directory', relPath: directory.relPath }),
    data: { kind: 'directory', relPath: directory.relPath },
  })

  const setNodeRef = useCombinedRefs(setDragRef, setDropRef)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`group relative border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors flex items-center justify-between select-none${
        isDragging ? ' opacity-40' : ''
      }${isSelected ? ' bg-accent' : ''}${isOver ? ' ring-2 ring-primary ring-offset-2' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Folder size={18} className={`shrink-0 ${isOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="font-medium truncate">{directory.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{directory.createdAt.slice(0, 10)}</p>
        </div>
      </div>
      <ItemContextMenu onRename={onRename} onTrash={onTrash} />
    </div>
  )
}
