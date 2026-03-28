// Windows/Linux/Mac すべてで使えないフォルダ名文字を除去する
export function toFolderName(title: string): string {
  const sanitized = title
    .replace(/[/\\:*?"<>|]/g, '') // 各OS禁止文字
    .replace(/\0/g, '')           // nullバイト
    .trim()
    .replace(/\.+$/, '')          // Windowsは末尾ドット不可

  return sanitized || `project-${Date.now()}`
}
