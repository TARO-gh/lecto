import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DirectoryMeta, ProjectMeta } from '../../types/electron'

export type SortKey = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc'

interface BreadcrumbItem {
  name: string
  relPath: string | null
}

interface DirectoryBrowserState {
  currentRelPath: string | null
  breadcrumbPath: BreadcrumbItem[]
  directories: DirectoryMeta[]
  projects: ProjectMeta[]
  loading: boolean
  sortKey: SortKey
  setSortKey: (key: SortKey) => void
  navigateInto: (relPath: string) => void
  navigateTo: (relPath: string | null) => void
  refresh: () => Promise<void>
  // 検索
  isSearching: boolean
  inputValue: string
  setInputValue: (v: string) => void
  commitSearch: (value: string) => void
  clearSearch: () => void
  searchDirectories: DirectoryMeta[]
  searchProjects: ProjectMeta[]
  searchQuery: string
}

function sortItems<T extends { name?: string; title?: string; createdAt: string; updatedAt: string }>(
  items: T[],
  key: SortKey
): T[] {
  return [...items].sort((a, b) => {
    switch (key) {
      case 'name_asc':
        return (a.name ?? a.title ?? '').localeCompare(b.name ?? b.title ?? '')
      case 'name_desc':
        return (b.name ?? b.title ?? '').localeCompare(a.name ?? a.title ?? '')
      case 'created_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'updated_asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      case 'updated_desc':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })
}

export function useDirectoryBrowser(): DirectoryBrowserState {
  const [currentRelPath, setCurrentRelPath] = useState<string | null>(null)
  const [allDirectories, setAllDirectories] = useState<DirectoryMeta[]>([])
  const [allDirectoriesFlat, setAllDirectoriesFlat] = useState<DirectoryMeta[]>([])
  const [allProjects, setAllProjects] = useState<ProjectMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')

  // 検索 state
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const isSearching = searchQuery.length > 0

  const refresh = useCallback(async () => {
    setLoading(true)
    const [dirs, projs] = await Promise.all([
      window.electronAPI.listAllDirectories(),
      window.electronAPI.listProjects(),
    ])
    setAllDirectoriesFlat(dirs)
    setAllDirectories([])  // rawDirectories 再取得トリガー
    setAllProjects(projs)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // currentRelPath または allDirectories が変わったらディレクトリ一覧を再取得
  const [rawDirectories, setRawDirectories] = useState<DirectoryMeta[]>([])
  useEffect(() => {
    window.electronAPI.listDirectories(currentRelPath).then(setRawDirectories)
  }, [currentRelPath, allDirectories])

  // 現在地のプロジェクトを絞り込む
  const filteredProjects = allProjects.filter(p => {
    const parts = p.folderName.split('/')
    if (currentRelPath === null) return parts.length === 1
    const prefix = currentRelPath.split('/')
    return (
      p.folderName.startsWith(currentRelPath + '/') &&
      parts.length === prefix.length + 1
    )
  })

  // ソート適用（ディレクトリは常に上、プロジェクトは常に下）
  const directories = sortItems(rawDirectories, sortKey)
  const projects = sortItems(
    filteredProjects.map(p => ({ ...p, name: p.title })),
    sortKey
  ).map(({ name: _name, ...p }) => p as ProjectMeta)

  // 検索結果（case-insensitive）
  const searchDirectories = useMemo(() => {
    if (!isSearching) return []
    const q = searchQuery.toLowerCase()
    return allDirectoriesFlat.filter(d => d.name.toLowerCase().includes(q))
  }, [isSearching, searchQuery, allDirectoriesFlat])

  const searchProjects = useMemo(() => {
    if (!isSearching) return []
    const q = searchQuery.toLowerCase()
    return allProjects.filter(p => p.title.toLowerCase().includes(q))
  }, [isSearching, searchQuery, allProjects])

  // パンくずを構築
  const breadcrumbPath: BreadcrumbItem[] = [{ name: 'Vault', relPath: null }]
  if (currentRelPath) {
    const parts = currentRelPath.split('/')
    parts.forEach((part, i) => {
      breadcrumbPath.push({
        name: part,
        relPath: parts.slice(0, i + 1).join('/'),
      })
    })
  }

  const navigateInto = (relPath: string) => setCurrentRelPath(relPath)
  const navigateTo = (relPath: string | null) => setCurrentRelPath(relPath)

  const commitSearch = (value: string) => setSearchQuery(value.trim())
  const clearSearch = () => { setSearchQuery(''); setInputValue('') }

  return {
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
  }
}
