import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'

const vaultConfigPath = path.join(app.getPath('userData'), 'vault.json')

export function getVaultPath(): string | null {
  if (!fs.existsSync(vaultConfigPath)) return null
  const data = JSON.parse(fs.readFileSync(vaultConfigPath, 'utf-8'))
  return data.vaultPath ?? null
}

function saveVaultPath(vaultPath: string) {
  fs.writeFileSync(vaultConfigPath, JSON.stringify({ vaultPath }, null, 2), 'utf-8')
}

export function registerVaultHandlers() {
  // 現在のVaultパスを取得
  ipcMain.handle('vault:getPath', () => {
    return getVaultPath()
  })

  // ディレクトリ選択ダイアログを開いてVaultを設定
  ipcMain.handle('vault:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Vaultフォルダを選択してください',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const vaultPath = result.filePaths[0]
    saveVaultPath(vaultPath)
    // projects フォルダを作成
    fs.mkdirSync(path.join(vaultPath, 'projects'), { recursive: true })
    return vaultPath
  })
}
