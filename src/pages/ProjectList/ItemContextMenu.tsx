import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'

interface Props {
  onRename: () => void
  onTrash: () => void
}

export function ItemContextMenu({ onRename, onTrash }: Props) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-no-dnd="true"
        onClick={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded hover:bg-background shrink-0 ml-2"
      >
        <MoreVertical size={15} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={onRename} className="gap-2 cursor-pointer">
          <Pencil size={14} />
          {t('projectList.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onTrash}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 size={14} />
          {t('projectList.moveToTrash')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
