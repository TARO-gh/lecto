import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { getVaultPath } from './vault'

function getProjectsDir(): string | null {
  const vaultPath = getVaultPath()
  if (!vaultPath) return null
  return path.join(vaultPath, 'projects')
}

interface DirectoryMeta {
  name: string
  relPath: string
  createdAt: string
  updatedAt: string
}

function scanDirectories(dir: string, projectsDir: string): DirectoryMeta[] {
  const results: DirectoryMeta[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const absPath = path.join(dir, entry.name)
    if (fs.existsSync(path.join(absPath, 'meta.json'))) continue
    const relPath = path.relative(projectsDir, absPath).replace(/\\/g, '/')
    const stat = fs.statSync(absPath)
    results.push({
      name: entry.name,
      relPath,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    })
    results.push(...scanDirectories(absPath, projectsDir))
  }
  return results
}

export function registerDirectoryHandlers() {
  // Vault全体のディレクトリ一覧（再帰）
  ipcMain.handle('directories:listAll', () => {
    const projectsDir = getProjectsDir()
    if (!projectsDir || !fs.existsSync(projectsDir)) return []
    return scanDirectories(projectsDir, projectsDir)
  })

  // ディレクトリ一覧（meta.json を持たないサブディレクトリ）
  ipcMain.handle('directories:list', (_e, parentRelPath: string | null) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir || !fs.existsSync(projectsDir)) return []

    const targetDir = parentRelPath
      ? path.join(projectsDir, parentRelPath)
      : projectsDir

    if (!fs.existsSync(targetDir)) return []

    return fs.readdirSync(targetDir, { withFileTypes: true })
      .filter(e => {
        if (!e.isDirectory()) return false
        return !fs.existsSync(path.join(targetDir, e.name, 'meta.json'))
      })
      .map(e => {
        const relPath = parentRelPath ? `${parentRelPath}/${e.name}` : e.name
        const stat = fs.statSync(path.join(targetDir, e.name))
        return {
          name: e.name,
          relPath,
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  // ディレクトリ作成
  ipcMain.handle('directories:create', (_e, { name, parentRelPath }: { name: string; parentRelPath: string | null }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) throw new Error('Vault not set')

    const parentDir = parentRelPath
      ? path.join(projectsDir, parentRelPath)
      : projectsDir
    const newDir = path.join(parentDir, name)

    if (fs.existsSync(newDir)) throw new Error(`"${name}" は既に存在します`)

    fs.mkdirSync(newDir, { recursive: true })

    const relPath = parentRelPath ? `${parentRelPath}/${name}` : name
    const stat = fs.statSync(newDir)
    return { name, relPath, createdAt: stat.birthtime.toISOString() }
  })

  // ディレクトリ名変更
  ipcMain.handle('directories:rename', (_e, { relPath, newName }: { relPath: string; newName: string }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return

    const oldPath = path.join(projectsDir, relPath)
    const newPath = path.join(path.dirname(oldPath), newName)

    if (newPath !== oldPath && fs.existsSync(newPath)) {
      throw new Error(`"${newName}" は既に存在します`)
    }

    fs.renameSync(oldPath, newPath)
  })

  // ディレクトリ移動
  ipcMain.handle('directories:move', (_e, { relPath, targetDirRelPath }: { relPath: string; targetDirRelPath: string | null }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) throw new Error('Vault not set')

    const oldAbsPath = path.join(projectsDir, relPath)
    const dirName = path.basename(oldAbsPath)

    const newParentAbsPath = targetDirRelPath
      ? path.join(projectsDir, targetDirRelPath)
      : projectsDir

    // 子孫チェック：自分の中に移動しようとしていないか
    if (newParentAbsPath.startsWith(oldAbsPath + path.sep)) {
      throw new Error('descendant')
    }

    // 同じ親なら何もしない
    if (newParentAbsPath === path.dirname(oldAbsPath)) return

    const newAbsPath = path.join(newParentAbsPath, dirName)

    if (fs.existsSync(newAbsPath)) throw new Error('name_conflict')

    fs.renameSync(oldAbsPath, newAbsPath)
  })

  // ディレクトリをOSゴミ箱へ（中のプロジェクトごと移動）
  ipcMain.handle('directories:trash', async (_e, { relPath }: { relPath: string }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return

    const fullPath = path.join(projectsDir, relPath)
    await shell.trashItem(fullPath)
  })
}
