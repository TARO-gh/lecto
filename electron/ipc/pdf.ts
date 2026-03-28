import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

export function registerPdfHandlers() {
  // PDFファイル選択ダイアログ
  ipcMain.handle('pdf:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? 'paper'
    return { filePath, fileName }
  })

  // PDFをArrayBufferとして読み込む
  ipcMain.handle('pdf:readFile', (_e, filePath: string) => {
    const buffer = fs.readFileSync(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  })

  // pymupdf4llm でPDFをMarkdown（ページ別）に変換
  ipcMain.handle('pdf:extractMarkdown', (_e, filePath: string): Promise<{ page: number; text: string }[]> => {
    return new Promise((resolve, reject) => {
      // 本番環境: バンドルされた extract_pdf.exe を使用
      // 開発環境: python スクリプトを直接実行
      let cmd: string
      let args: string[]
      if (app.isPackaged) {
        const binName = process.platform === 'win32' ? 'extract_pdf.exe' : 'extract_pdf'
        cmd = path.join(process.resourcesPath, 'extract_pdf', binName)
        args = [filePath]
      } else {
        const scriptPath = path.join(app.getAppPath(), 'scripts', 'extract_pdf.py')
        cmd = process.platform === 'win32' ? 'python' : 'python3'
        args = [scriptPath, filePath]
      }
      console.log('[pdf:extractMarkdown] cmd:', cmd)
      console.log('[pdf:extractMarkdown] args:', args)

      const py = spawn(cmd, args, { env: process.env })

      let stdout = ''
      let stderr = ''
      py.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf8') })
      py.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf8') })

      py.on('error', (err) => {
        console.error('[pdf:extractMarkdown] spawn error:', err)
        reject(new Error(`Failed to spawn Python: ${err.message}`))
      })

      py.on('close', (code) => {
        if (stderr) console.error('[pdf:extractMarkdown] Python stderr:\n', stderr)
        if (code !== 0) {
          console.error('[pdf:extractMarkdown] Python stdout on error:\n', stdout)
          reject(new Error(`Python exited with code ${code}: ${stderr || stdout}`))
          return
        }
        try {
          // stdout にはログメッセージが混入することがあるため JSON 部分だけ抽出
          const jsonStart = stdout.indexOf('[')
          if (jsonStart === -1) throw new Error(`No JSON array found in output:\n${stdout}`)
          const parsed = JSON.parse(stdout.slice(jsonStart))
          resolve(parsed as { page: number; text: string }[])
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e}`))
        }
      })
    })
  })
}
