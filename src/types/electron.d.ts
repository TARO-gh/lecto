export interface ProjectMeta {
  title: string
  folderName: string  // projects/ からの相対パス（例: "ML/論文名"、ルート直下は "論文名"）
  createdAt: string
  updatedAt: string
}

export interface DirectoryMeta {
  name: string
  relPath: string     // projects/ からの相対パス（例: "ML"、"ML/NLP"）
  createdAt: string
  updatedAt: string
}

export interface AiPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isDefault: boolean
}

export interface AppSettings {
  ai: {
    presets: AiPreset[]
  }
  language: string
  translationLanguage: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Chat {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  contextSections?: string[]
  messages: ChatMessage[]
}

export interface ChatMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ElectronAPI {
  // Vault
  getVaultPath: () => Promise<string | null>
  selectVault: () => Promise<string | null>

  // 設定
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>

  // プロジェクト
  listProjects: () => Promise<ProjectMeta[]>
  createProject: (args: { title: string; folderName: string; pdfSrcPath: string; directoryRelPath?: string | null }) => Promise<ProjectMeta>
  updateProjectTitle: (args: { folderName: string; title: string }) => Promise<void>
  renameProject: (args: { folderName: string; newTitle: string }) => Promise<void>
  deleteProject: (folderName: string) => Promise<void>
  getPdfPath: (folderName: string) => Promise<string | null>
  loadSections: (folderName: string) => Promise<import('./pdf').RawSection[] | null>
  saveSections: (folderName: string, sections: import('./pdf').RawSection[]) => Promise<void>

  // ディレクトリ
  listDirectories: (parentRelPath: string | null) => Promise<DirectoryMeta[]>
  listAllDirectories: () => Promise<DirectoryMeta[]>
  createDirectory: (args: { name: string; parentRelPath: string | null }) => Promise<DirectoryMeta>
  renameDirectory: (args: { relPath: string; newName: string }) => Promise<void>
  trashDirectory: (args: { relPath: string }) => Promise<void>
  moveProject: (args: { folderName: string; targetDirRelPath: string | null }) => Promise<ProjectMeta>
  moveDirectory: (args: { relPath: string; targetDirRelPath: string | null }) => Promise<void>

  // チャット履歴
  listChats: (folderName: string) => Promise<ChatMeta[]>
  loadChat: (folderName: string, chatId: string) => Promise<Chat | null>
  saveChat: (folderName: string, chat: Chat) => Promise<void>
  deleteChat: (folderName: string, chatId: string) => Promise<void>

  // PDF
  selectPdfFile: () => Promise<{ filePath: string; fileName: string } | null>
  readPdfFile: (filePath: string) => Promise<ArrayBuffer>
  extractPdfMarkdown: (filePath: string) => Promise<{ page: number; text: string }[]>

  // ノート
  noteLoad: (folderName: string) => Promise<string>
  noteSave: (folderName: string, content: string) => Promise<void>

  // AI
  aiTranslate: (
    args: { text: string; targetLanguage: string; presetId: string },
    onChunk: (chunk: string) => void,
    onDone: (error: string | null, model: string | null) => void
  ) => void
  aiChat: (
    args: { messages: { role: 'user' | 'assistant'; content: string }[]; context: string; presetId: string },
    onChunk: (chunk: string) => void,
    onDone: (error?: string) => void
  ) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
