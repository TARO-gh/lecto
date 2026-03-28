import { app, BrowserWindow, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { registerVaultHandlers } from './ipc/vault'
import { registerSettingsHandlers } from './ipc/settings'
import { registerProjectHandlers } from './ipc/projects'
import { registerPdfHandlers } from './ipc/pdf'
import { registerAiHandlers } from './ipc/ai'
import { registerChatHandlers } from './ipc/chats'
import { registerDirectoryHandlers } from './ipc/directories'
import { registerNoteHandlers } from './ipc/note'

if (process.platform === 'darwin') {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]))
} else {
  Menu.setApplicationMenu(null)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  registerVaultHandlers()
  registerSettingsHandlers()
  registerProjectHandlers()
  registerPdfHandlers()
  registerAiHandlers()
  registerChatHandlers()
  registerDirectoryHandlers()
  registerNoteHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
