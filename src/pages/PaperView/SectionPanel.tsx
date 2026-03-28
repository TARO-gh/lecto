import { useTranslation } from 'react-i18next'
import { PanelLeftClose, CheckCircle } from 'lucide-react'
import type { OutlineItem, RawSection } from '../../types/pdf'

interface Props {
  outline: OutlineItem[]
  sections: RawSection[]
  selectedTitle: string | null
  goToPage: (page: number) => void
  onSectionClick: (section: RawSection) => void
  onClose: () => void
}

function OutlineNode({
  item,
  sections,
  selectedTitle,
  goToPage,
  onSectionClick,
}: {
  item: OutlineItem
  sections: RawSection[]
  selectedTitle: string | null
  goToPage: (page: number) => void
  onSectionClick: (section: RawSection) => void
}) {
  const isSelected = item.title === selectedTitle
  const matched = sections.find(s => s.title === item.title)
  const isTranslated = !!matched?.translation

  const handleClick = () => {
    goToPage(item.pageNumber)
    if (matched) onSectionClick(matched)
  }

  return (
    <li>
      <button
        onClick={handleClick}
        className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors flex items-center gap-1 ${
          isSelected ? 'bg-accent font-medium' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
        title={item.title}
      >
        <span className="truncate flex-1">{item.title}</span>
        {isTranslated && <CheckCircle size={11} className="shrink-0 text-muted-foreground" />}
      </button>
      {item.items.length > 0 && (
        <ul>
          {item.items.map((child, i) => (
            <OutlineNode
              key={i}
              item={child}
              sections={sections}
              selectedTitle={selectedTitle}
              goToPage={goToPage}
              onSectionClick={onSectionClick}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function SectionPanel({ outline, sections, selectedTitle, goToPage, onSectionClick, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div className="p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('paperView.sections')}
        </p>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          title="セクションパネルを閉じる"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      {outline.length === 0 ? (
        <p className="text-xs text-muted-foreground px-2">抽出中...</p>
      ) : (
        <ul className="space-y-0.5">
          {outline.map((item, i) => (
            <OutlineNode
              key={i}
              item={item}
              sections={sections}
              selectedTitle={selectedTitle}
              goToPage={goToPage}
              onSectionClick={onSectionClick}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
