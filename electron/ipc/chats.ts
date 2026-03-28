import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { getVaultPath } from './vault'

function getChatsDir(folderName: string) {
  const vaultPath = getVaultPath()
  if (!vaultPath) return null
  return path.join(vaultPath, 'projects', folderName, 'chats')
}

export function registerChatHandlers() {
  // チャット一覧（メタ情報のみ）
  ipcMain.handle('chats:list', (_e, folderName: string) => {
    const chatsDir = getChatsDir(folderName)
    if (!chatsDir || !fs.existsSync(chatsDir)) return []

    return fs.readdirSync(chatsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8'))
        return { id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt }
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  // チャット読み込み
  ipcMain.handle('chats:load', (_e, folderName: string, chatId: string) => {
    const chatsDir = getChatsDir(folderName)
    if (!chatsDir) return null
    const filePath = path.join(chatsDir, `${chatId}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  })

  // チャット保存
  ipcMain.handle('chats:save', (_e, folderName: string, chat: { id: string }) => {
    const chatsDir = getChatsDir(folderName)
    if (!chatsDir) return
    fs.mkdirSync(chatsDir, { recursive: true })
    fs.writeFileSync(path.join(chatsDir, `${chat.id}.json`), JSON.stringify(chat, null, 2), 'utf-8')
  })

  // チャット削除
  ipcMain.handle('chats:delete', (_e, folderName: string, chatId: string) => {
    const chatsDir = getChatsDir(folderName)
    if (!chatsDir) return
    const filePath = path.join(chatsDir, `${chatId}.json`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  })
}
