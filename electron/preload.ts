import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Vault
  getVaultPath: () => ipcRenderer.invoke('vault:getPath'),
  selectVault: () => ipcRenderer.invoke('vault:select'),

  // 設定
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  // プロジェクト
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (args: { title: string; folderName: string; pdfSrcPath: string; directoryRelPath?: string | null }) =>
    ipcRenderer.invoke('projects:create', args),
  updateProjectTitle: (args: { folderName: string; title: string }) =>
    ipcRenderer.invoke('projects:updateTitle', args),
  renameProject: (args: { folderName: string; newTitle: string }) =>
    ipcRenderer.invoke('projects:rename', args),
  deleteProject: (folderName: string) => ipcRenderer.invoke('projects:delete', folderName),
  getPdfPath: (folderName: string) => ipcRenderer.invoke('projects:getPdfPath', folderName),
  loadSections: (folderName: string) => ipcRenderer.invoke('projects:loadSections', folderName),
  saveSections: (folderName: string, sections: unknown[]) => ipcRenderer.invoke('projects:saveSections', folderName, sections),

  // ディレクトリ
  listDirectories: (parentRelPath: string | null) => ipcRenderer.invoke('directories:list', parentRelPath),
  listAllDirectories: () => ipcRenderer.invoke('directories:listAll'),
  createDirectory: (args: { name: string; parentRelPath: string | null }) => ipcRenderer.invoke('directories:create', args),
  renameDirectory: (args: { relPath: string; newName: string }) => ipcRenderer.invoke('directories:rename', args),
  trashDirectory: (args: { relPath: string }) => ipcRenderer.invoke('directories:trash', args),
  moveProject: (args: { folderName: string; targetDirRelPath: string | null }) =>
    ipcRenderer.invoke('projects:move', args),
  moveDirectory: (args: { relPath: string; targetDirRelPath: string | null }) =>
    ipcRenderer.invoke('directories:move', args),

  // PDF
  selectPdfFile: () => ipcRenderer.invoke('pdf:selectFile'),
  readPdfFile: (filePath: string) => ipcRenderer.invoke('pdf:readFile', filePath),
  extractPdfMarkdown: (filePath: string) => ipcRenderer.invoke('pdf:extractMarkdown', filePath),

  // チャット履歴
  listChats: (folderName: string) => ipcRenderer.invoke('chats:list', folderName),
  loadChat: (folderName: string, chatId: string) => ipcRenderer.invoke('chats:load', folderName, chatId),
  saveChat: (folderName: string, chat: unknown) => ipcRenderer.invoke('chats:save', folderName, chat),
  deleteChat: (folderName: string, chatId: string) => ipcRenderer.invoke('chats:delete', folderName, chatId),

  // ノート
  noteLoad: (folderName: string) => ipcRenderer.invoke('note:load', folderName),
  noteSave: (folderName: string, content: string) => ipcRenderer.invoke('note:save', folderName, content),

  // AI（ストリーミング）
  aiTranslate: (
    args: { text: string; targetLanguage: string; presetId: string },
    onChunk: (chunk: string) => void,
    onDone: (error: string | null, model: string | null) => void
  ) => {
    const id = Math.random().toString(36).slice(2)
    const chunkHandler = (_: unknown, reqId: string, chunk: string) => {
      if (reqId === id) onChunk(chunk)
    }
    const doneHandler = (_: unknown, reqId: string, error: string | null, model: string | null) => {
      if (reqId === id) {
        ipcRenderer.off('ai:chunk', chunkHandler)
        ipcRenderer.off('ai:done', doneHandler)
        onDone(error, model)
      }
    }
    ipcRenderer.on('ai:chunk', chunkHandler)
    ipcRenderer.on('ai:done', doneHandler)
    ipcRenderer.invoke('ai:translate', { ...args, id })
  },

  aiChat: (
    args: { messages: { role: 'user' | 'assistant'; content: string }[]; context: string; presetId: string },
    onChunk: (chunk: string) => void,
    onDone: (error?: string) => void
  ) => {
    const id = Math.random().toString(36).slice(2)
    const chunkHandler = (_: unknown, reqId: string, chunk: string) => {
      if (reqId === id) onChunk(chunk)
    }
    const doneHandler = (_: unknown, reqId: string, error?: string) => {
      if (reqId === id) {
        ipcRenderer.off('ai:chunk', chunkHandler)
        ipcRenderer.off('ai:done', doneHandler)
        onDone(error)
      }
    }
    ipcRenderer.on('ai:chunk', chunkHandler)
    ipcRenderer.on('ai:done', doneHandler)
    ipcRenderer.invoke('ai:chat', { ...args, id })
    return () => { ipcRenderer.invoke('ai:abort', id) }
  },

})
