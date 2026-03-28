import React from 'react'
import { FileText } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { ProjectMeta } from '../../types/electron'
import { ItemContextMenu } from './ItemContextMenu'
import { dragId } from './dnd'

interface Props {
  project: ProjectMeta
  currentDirRelPath: string | null
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onOpen: () => void
  onRename: () => void
  onTrash: () => void
}

export function ProjectCard({ project, currentDirRelPath, isSelected, onSelect, onOpen, onRename, onTrash }: Props) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: dragId({ kind: 'project', folderName: project.folderName, currentDirRelPath }),
    data: { kind: 'project', folderName: project.folderName, currentDirRelPath },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`group relative border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors flex items-center justify-between select-none${
        isDragging ? ' opacity-40' : ''
      }${isSelected ? ' bg-accent' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText size={18} className="shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium truncate">{project.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{project.createdAt.slice(0, 10)}</p>
        </div>
      </div>
      <ItemContextMenu onRename={onRename} onTrash={onTrash} />
    </div>
  )
}
