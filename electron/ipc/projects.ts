import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { getVaultPath } from './vault'

interface Meta {
  title: string
  folderName: string
  createdAt: string
  updatedAt: string
}

function getProjectsDir() {
  const vaultPath = getVaultPath()
  if (!vaultPath) return null
  return path.join(vaultPath, 'projects')
}

function readMeta(projectDir: string): Meta {
  return JSON.parse(fs.readFileSync(path.join(projectDir, 'meta.json'), 'utf-8'))
}

function writeMeta(projectDir: string, meta: Meta) {
  fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
}

function initProjectFiles(projectDir: string) {
  if (!fs.existsSync(path.join(projectDir, 'sections.json'))) {
    fs.writeFileSync(path.join(projectDir, 'sections.json'), '[]', 'utf-8')
  }
}

function toFolderName(title: string): string {
  const sanitized = title
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\0/g, '')
    .trim()
    .replace(/\.+$/, '')
  return sanitized || `project-${Date.now()}`
}

// meta.json を持つディレクトリを再帰的に収集する
function scanProjects(dir: string, projectsDir: string): Meta[] {
  const results: Meta[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const entryPath = path.join(dir, entry.name)
    const metaPath = path.join(entryPath, 'meta.json')
    if (fs.existsSync(metaPath)) {
      const meta = readMeta(entryPath)
      // folderName を projects/ からの相対パス（/ 区切り）に変換
      meta.folderName = path.relative(projectsDir, entryPath).replace(/\\/g, '/')
      results.push(meta)
    } else {
      // meta.json がない = ディレクトリ → 再帰的に探す
      results.push(...scanProjects(entryPath, projectsDir))
    }
  }
  return results
}

export function registerProjectHandlers() {
  // プロジェクト一覧取得（再帰スキャン）
  ipcMain.handle('projects:list', () => {
    const projectsDir = getProjectsDir()
    if (!projectsDir || !fs.existsSync(projectsDir)) return []

    return scanProjects(projectsDir, projectsDir)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  // プロジェクト作成
  ipcMain.handle('projects:create', (_e, {
    title, folderName, pdfSrcPath, directoryRelPath
  }: {
    title: string
    folderName: string
    pdfSrcPath: string
    directoryRelPath?: string | null
  }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) throw new Error('Vault not set')

    const parentDir = directoryRelPath
      ? path.join(projectsDir, directoryRelPath)
      : projectsDir
    const projectDir = path.join(parentDir, folderName)

    if (fs.existsSync(projectDir)) throw new Error(`フォルダ名 "${folderName}" は既に存在します`)

    fs.mkdirSync(projectDir, { recursive: true })

    const now = new Date().toISOString()
    const meta: Meta = { title, folderName, createdAt: now, updatedAt: now }
    writeMeta(projectDir, meta)
    initProjectFiles(projectDir)

    fs.copyFileSync(pdfSrcPath, path.join(projectDir, 'paper.pdf'))

    // 返す folderName は projects/ からの相対パス
    const relFolderName = directoryRelPath
      ? `${directoryRelPath}/${folderName}`
      : folderName
    return { ...meta, folderName: relFolderName }
  })

  // タイトル更新
  ipcMain.handle('projects:updateTitle', (_e, { folderName, title }: { folderName: string; title: string }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return
    const projectDir = path.join(projectsDir, folderName)
    const meta = readMeta(projectDir)
    meta.title = title
    meta.updatedAt = new Date().toISOString()
    writeMeta(projectDir, meta)
  })

  // プロジェクト名変更（タイトル変更 + フォルダリネーム）
  ipcMain.handle('projects:rename', (_e, { folderName, newTitle }: { folderName: string; newTitle: string }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return

    const projectDir = path.join(projectsDir, folderName)
    const newFolderLeaf = toFolderName(newTitle)
    const parentDir = path.dirname(projectDir)
    const newProjectDir = path.join(parentDir, newFolderLeaf)

    if (newProjectDir !== projectDir && fs.existsSync(newProjectDir)) {
      throw new Error(`"${newFolderLeaf}" は既に存在します`)
    }

    // meta.json を更新
    const meta = readMeta(projectDir)
    meta.title = newTitle
    meta.folderName = newFolderLeaf
    meta.updatedAt = new Date().toISOString()
    writeMeta(projectDir, meta)

    // フォルダをリネーム
    if (newProjectDir !== projectDir) {
      fs.renameSync(projectDir, newProjectDir)
    }
  })

  // プロジェクト削除（OSゴミ箱へ）
  ipcMain.handle('projects:delete', async (_e, folderName: string) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return
    const projectDir = path.join(projectsDir, folderName)
    await shell.trashItem(projectDir)
  })

  // プロジェクト移動
  ipcMain.handle('projects:move', (_e, { folderName, targetDirRelPath }: { folderName: string; targetDirRelPath: string | null }) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) throw new Error('Vault not set')

    const oldProjectDir = path.join(projectsDir, folderName)
    const leafName = path.basename(oldProjectDir)

    const newParentDir = targetDirRelPath
      ? path.join(projectsDir, targetDirRelPath)
      : projectsDir
    const newProjectDir = path.join(newParentDir, leafName)

    if (newProjectDir === oldProjectDir) return readMeta(oldProjectDir)

    if (fs.existsSync(newProjectDir)) throw new Error('name_conflict')

    fs.renameSync(oldProjectDir, newProjectDir)

    const newFolderName = targetDirRelPath
      ? `${targetDirRelPath}/${leafName}`
      : leafName

    const meta = readMeta(newProjectDir)
    meta.folderName = newFolderName
    meta.updatedAt = new Date().toISOString()
    writeMeta(newProjectDir, meta)

    return meta
  })

  // PDFパス取得
  ipcMain.handle('projects:getPdfPath', (_e, folderName: string) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return null
    return path.join(projectsDir, folderName, 'paper.pdf')
  })

  // sections.json 読み込み（存在しない or 空なら null）
  ipcMain.handle('projects:loadSections', (_e, folderName: string) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return null
    const sectionsPath = path.join(projectsDir, folderName, 'sections.json')
    if (!fs.existsSync(sectionsPath)) return null
    const data = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'))
    return Array.isArray(data) && data.length > 0 ? data : null
  })

  // sections.json 保存
  ipcMain.handle('projects:saveSections', (_e, folderName: string, sections: unknown[]) => {
    const projectsDir = getProjectsDir()
    if (!projectsDir) return
    const sectionsPath = path.join(projectsDir, folderName, 'sections.json')
    fs.writeFileSync(sectionsPath, JSON.stringify(sections, null, 2), 'utf-8')
  })
}
