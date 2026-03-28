import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { getVaultPath } from './vault'

function getNotePath(folderName: string): string {
  const vault = getVaultPath()
  if (!vault) throw new Error('Vault not set')
  return path.join(vault, 'projects', folderName, 'note.md')
}

export function registerNoteHandlers() {
  ipcMain.handle('note:load', (_event, folderName: string): string => {
    const filePath = getNotePath(folderName)
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('note:save', (_event, folderName: string, content: string): void => {
    const filePath = getNotePath(folderName)
    fs.writeFileSync(filePath, content, 'utf-8')
  })
}
