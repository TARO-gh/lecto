import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, FolderOpen, FolderPlus, Search, Trash2, X } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DirectoryMeta, ProjectMeta } from '../../types/electron'
import { NewProjectDialog } from '../../components/NewProjectDialog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { useDirectoryBrowser, type SortKey } from './useDirectoryBrowser'
import { Breadcrumb } from './Breadcrumb'
import { ProjectGrid } from './ProjectGrid'
import { NewDirectoryDialog } from './NewDirectoryDialog'
import { RenameDialog } from './RenameDialog'
import { SmartPointerSensor } from './SmartPointerSensor'
import { DragPreviewCard } from './DragPreviewCard'
import type { DragItemData, DropZoneData } from './dnd'

export default function ProjectList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [vaultPath, setVaultPath] = useState<string | null>(null)

  const {
    currentRelPath,
    breadcrumbPath,
    directories,
    projects,
    loading,
    sortKey,
    setSortKey,
    navigateInto,
    navigateTo,
    refresh,
    isSearching,
    inputValue,
    setInputValue,
    commitSearch,
    clearSearch,
    searchDirectories,
    searchProjects,
    searchQuery,
  } = useDirectoryBrowser()

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'name_asc',      label: t('projectList.sortNameAsc') },
    { key: 'name_desc',     label: t('projectList.sortNameDesc') },
    { key: 'created_desc',  label: t('projectList.sortCreatedDesc') },
    { key: 'created_asc',   label: t('projectList.sortCreatedAsc') },
    { key: 'updated_desc',  label: t('projectList.sortUpdatedDesc') },
    { key: 'updated_asc',   label: t('projectList.sortUpdatedAsc') },
  ]

  // ダイアログ state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [showNewDirectoryDialog, setShowNewDirectoryDialog] = useState(false)
  const [renamingDir, setRenamingDir] = useState<DirectoryMeta | null>(null)
  const [renamingProject, setRenamingProject] = useState<ProjectMeta | null>(null)
  const [trashingDirRelPath, setTrashingDirRelPath] = useState<string | null>(null)
  const [trashingProjectFolderName, setTrashingProjectFolderName] = useState<string | null>(null)
  const [showBulkTrashConfirm, setShowBulkTrashConfirm] = useState(false)

  // 選択 state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // DnD state
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null)
  const [isDraggingMultiple, setIsDraggingMultiple] = useState(false)
  const [dndError, setDndError] = useState<string | null>(null)

  // Shift 範囲選択用の順序リスト
  const orderedIds = useMemo(() => [
    ...directories.map(d => `dir::${d.relPath}`),
    ...projects.map(p => `proj::${p.folderName}`),
  ], [directories, projects])

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(PointerSensor,      { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    window.electronAPI.getVaultPath().then(setVaultPath)
  }, [])

  // Escape で選択解除
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // DnD エラートーストを5秒後に消す
  useEffect(() => {
    if (!dndError) return
    const timer = setTimeout(() => setDndError(null), 5000)
    return () => clearTimeout(timer)
  }, [dndError])

  // ディレクトリ移動時に選択リセット
  useEffect(() => {
    setSelectedIds(new Set())
    setLastClickedId(null)
  }, [currentRelPath])

  // --- 選択ハンドラ ---
  function handleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const isCtrl = e.ctrlKey || e.metaKey

    if (e.shiftKey && lastClickedId) {
      const a = orderedIds.indexOf(lastClickedId)
      const b = orderedIds.indexOf(id)
      const range = orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1)
      setSelectedIds(prev => {
        const next = new Set(prev)
        range.forEach(i => next.add(i))
        return next
      })
    } else if (isCtrl) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
      setLastClickedId(id)
    } else {
      setSelectedIds(new Set([id]))
      setLastClickedId(id)
    }
  }

  // --- Vault ---
  const handleSelectVault = async () => {
    const vault = await window.electronAPI.selectVault()
    if (vault) { setVaultPath(vault); refresh() }
  }

  // --- 名前変更 ---
  const handleRenameDirectory = async (newName: string) => {
    if (!renamingDir) return
    await window.electronAPI.renameDirectory({ relPath: renamingDir.relPath, newName })
    setRenamingDir(null)
    refresh()
  }

  const handleRenameProject = async (newTitle: string) => {
    if (!renamingProject) return
    await window.electronAPI.renameProject({ folderName: renamingProject.folderName, newTitle })
    setRenamingProject(null)
    refresh()
  }

  // --- 削除 ---
  const handleTrashDirectory = async () => {
    if (!trashingDirRelPath) return
    await window.electronAPI.trashDirectory({ relPath: trashingDirRelPath })
    setTrashingDirRelPath(null)
    refresh()
  }

  const handleTrashProject = async () => {
    if (!trashingProjectFolderName) return
    await window.electronAPI.deleteProject(trashingProjectFolderName)
    setTrashingProjectFolderName(null)
    refresh()
  }

  // --- 一括ゴミ箱 ---
  const handleBulkTrash = async () => {
    for (const id of selectedIds) {
      if (id.startsWith('proj::')) {
        await window.electronAPI.deleteProject(id.slice(6))
      } else {
        await window.electronAPI.trashDirectory({ relPath: id.slice(5) })
      }
    }
    setSelectedIds(new Set())
    setShowBulkTrashConfirm(false)
    refresh()
  }

  // --- DnD ---
  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as DragItemData
    setActiveItem(item)
    const draggedId = String(event.active.id)
    if (selectedIds.has(draggedId) && selectedIds.size > 1) {
      setIsDraggingMultiple(true)
    } else {
      // 非選択アイテムのドラッグ → 選択解除
      setSelectedIds(new Set())
      setIsDraggingMultiple(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)
    setIsDraggingMultiple(false)

    if (!over || active.id === over.id) return

    const zone = over.data.current as DropZoneData
    const targetDirRelPath = zone.kind === 'directory' ? zone.relPath : null

    const draggedId = String(active.id)
    const idsToMove = (selectedIds.has(draggedId) && selectedIds.size > 1)
      ? [...selectedIds]
      : [draggedId]

    let hasConflict = false

    for (const id of idsToMove) {
      try {
        if (id.startsWith('proj::')) {
          const folderName = id.slice(6)
          await window.electronAPI.moveProject({ folderName, targetDirRelPath })
        } else {
          const relPath = id.slice(5)
          // 子孫チェック
          if (targetDirRelPath !== null && targetDirRelPath.startsWith(relPath + '/')) continue
          await window.electronAPI.moveDirectory({ relPath, targetDirRelPath })
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'name_conflict') hasConflict = true
      }
    }

    if (hasConflict) setDndError(t('projectList.moveConflict'))
    setSelectedIds(new Set())
    refresh()
  }

  const handleDragCancel = () => {
    setActiveItem(null)
    setIsDraggingMultiple(false)
  }

  // --- Vault 未設定 ---
  if (vaultPath === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p className="text-lg font-medium text-foreground">{t('projectList.vaultPrompt')}</p>
        <p className="text-sm">{t('projectList.vaultPromptHint')}</p>
        <button
          onClick={handleSelectVault}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          <FolderOpen size={16} />
          {t('projectList.selectVault')}
        </button>
      </div>
    )
  }

  const isEmpty = !loading && directories.length === 0 && projects.length === 0

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <>
        <div
          className="p-6 max-w-4xl mx-auto"
          onClick={() => setSelectedIds(new Set())}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-4 select-none">
            <div>
              <h1 className="text-2xl font-semibold">{t('projectList.title')}</h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{vaultPath}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleSelectVault() }}
                className="flex items-center gap-1 text-sm text-muted-foreground border px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <FolderOpen size={14} />
                {t('projectList.switchVault')}
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowNewDirectoryDialog(true) }}
                className="flex items-center gap-1 text-sm border px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <FolderPlus size={14} />
                {t('projectList.newDirectory')}
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowNewProjectDialog(true) }}
                className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                {t('projectList.newProject')}
              </button>
            </div>
          </div>

          {/* パンくず + 検索 + 並び替え */}
          <div className="mb-5 flex items-center justify-between gap-2">
            <Breadcrumb path={breadcrumbPath} isDragging={activeItem !== null} isSearching={isSearching} onNavigate={navigateTo} />
            <div className="flex items-center gap-1 shrink-0 select-none">
              <form
                onSubmit={e => { e.preventDefault(); commitSearch(inputValue) }}
                className="flex items-center"
              >
                <div className="relative flex items-center">
                  <Search size={13} className="absolute left-2 text-muted-foreground pointer-events-none" />
                  <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={t('projectList.searchPlaceholder')}
                    className="pl-7 pr-6 py-1 text-sm border rounded-md bg-background w-44 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {inputValue && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </form>
              <DropdownMenu>
                <DropdownMenuTrigger className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground">
                  <ArrowUpDown size={13} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sortOptions.map(o => (
                    <DropdownMenuItem
                      key={o.key}
                      onClick={() => setSortKey(o.key)}
                      className={`cursor-pointer ${sortKey === o.key ? 'font-semibold' : ''}`}
                    >
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* コンテンツ */}
          {isSearching ? (
            searchDirectories.length === 0 && searchProjects.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                <p className="text-lg">{t('projectList.noSearchResults', { query: searchQuery })}</p>
              </div>
            ) : (
              <ProjectGrid
                directories={searchDirectories}
                projects={searchProjects}
                currentRelPath={currentRelPath}
                isSearchMode
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onOpenDirectory={relPath => { clearSearch(); navigateInto(relPath) }}
                onOpenProject={folderName => navigate(`/paper/${encodeURIComponent(folderName)}`)}
                onRenameDirectory={setRenamingDir}
                onRenameProject={setRenamingProject}
                onTrashDirectory={setTrashingDirRelPath}
                onTrashProject={setTrashingProjectFolderName}
              />
            )
          ) : isEmpty ? (
            <div className="text-center py-24 text-muted-foreground">
              {currentRelPath === null ? (
                <>
                  <p className="text-lg">{t('projectList.noProjects')}</p>
                  <p className="text-sm mt-2">{t('projectList.noProjectsHint')}</p>
                </>
              ) : (
                <>
                  <p className="text-lg">{t('projectList.emptyDirectory')}</p>
                  <p className="text-sm mt-2">{t('projectList.emptyDirectoryHint')}</p>
                </>
              )}
            </div>
          ) : (
            <ProjectGrid
              directories={directories}
              projects={projects}
              currentRelPath={currentRelPath}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onOpenDirectory={navigateInto}
              onOpenProject={folderName => navigate(`/paper/${encodeURIComponent(folderName)}`)}
              onRenameDirectory={setRenamingDir}
              onRenameProject={setRenamingProject}
              onTrashDirectory={setTrashingDirRelPath}
              onTrashProject={setTrashingProjectFolderName}
            />
          )}
        </div>

        {/* フローティングツールバー */}
        {selectedIds.size > 1 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-background border shadow-xl rounded-full px-5 py-2.5 text-sm select-none">
            <span className="text-muted-foreground">
              {t('projectList.selected', { count: selectedIds.size })}
            </span>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setShowBulkTrashConfirm(true)}
              className="flex items-center gap-1.5 text-destructive hover:opacity-70 transition-opacity"
            >
              <Trash2 size={14} />
              {t('projectList.moveToTrash')}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* DnD エラートースト */}
        {dndError && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-sm px-4 py-2 rounded-md shadow-lg z-50">
            {dndError}
          </div>
        )}

        {/* 新規プロジェクトダイアログ */}
        {showNewProjectDialog && (
          <NewProjectDialog
            directoryRelPath={currentRelPath}
            onCreated={() => { setShowNewProjectDialog(false); refresh() }}
            onClose={() => setShowNewProjectDialog(false)}
          />
        )}

        {/* 新規ディレクトリダイアログ */}
        {showNewDirectoryDialog && (
          <NewDirectoryDialog
            parentRelPath={currentRelPath}
            onCreated={() => { setShowNewDirectoryDialog(false); refresh() }}
            onClose={() => setShowNewDirectoryDialog(false)}
          />
        )}

        {/* ディレクトリ名変更 */}
        {renamingDir && (
          <RenameDialog
            initialName={renamingDir.name}
            onConfirm={handleRenameDirectory}
            onClose={() => setRenamingDir(null)}
          />
        )}

        {/* プロジェクト名変更 */}
        {renamingProject && (
          <RenameDialog
            initialName={renamingProject.title}
            onConfirm={handleRenameProject}
            onClose={() => setRenamingProject(null)}
          />
        )}

        {/* ディレクトリ削除確認 */}
        {trashingDirRelPath && (
          <ConfirmDialog
            message={t('projectList.deleteDirectoryConfirm')}
            onConfirm={handleTrashDirectory}
            onClose={() => setTrashingDirRelPath(null)}
          />
        )}

        {/* プロジェクト削除確認 */}
        {trashingProjectFolderName && (
          <ConfirmDialog
            message={t('projectList.deleteConfirm')}
            onConfirm={handleTrashProject}
            onClose={() => setTrashingProjectFolderName(null)}
          />
        )}

        {/* 一括ゴミ箱確認 */}
        {showBulkTrashConfirm && (
          <ConfirmDialog
            message={t('projectList.bulkTrashConfirm', { count: selectedIds.size })}
            onConfirm={handleBulkTrash}
            onClose={() => setShowBulkTrashConfirm(false)}
          />
        )}
      </>

      <DragOverlay>
        {activeItem && (
          <DragPreviewCard
            item={activeItem}
            count={isDraggingMultiple ? selectedIds.size : undefined}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
