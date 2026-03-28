// ドラッグアイテムのデータ型
export type DragItemData =
  | { kind: 'project'; folderName: string; currentDirRelPath: string | null }
  | { kind: 'directory'; relPath: string; parentRelPath: string | null }

// ドロップゾーンのデータ型
export type DropZoneData =
  | { kind: 'directory'; relPath: string }
  | { kind: 'root' }

// ドラッグアイテムID の生成
export function dragId(item: DragItemData): string {
  if (item.kind === 'project') return `proj::${item.folderName}`
  return `dir::${item.relPath}`
}

// ドロップゾーンID の生成
export function dropId(zone: DropZoneData): string {
  if (zone.kind === 'root') return 'root'
  return `dir::${zone.relPath}`
}
