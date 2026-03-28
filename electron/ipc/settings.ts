import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { getVaultPath } from './vault'

const DEFAULT_PRESET = {
  id: 'default',
  name: 'GPT-4o',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  isDefault: true,
}

const DEFAULT_SETTINGS = {
  ai: {
    presets: [{ ...DEFAULT_PRESET }],
  },
  language: 'en',
  translationLanguage: 'en',
}

function getSettingsPath() {
  const vaultPath = getVaultPath()
  if (!vaultPath) return null
  return path.join(vaultPath, 'settings.json')
}

export function readSettings() {
  const settingsPath = getSettingsPath()
  if (!settingsPath || !fs.existsSync(settingsPath)) return DEFAULT_SETTINGS
  const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    ai: {
      presets: saved.ai?.presets?.length ? saved.ai.presets : DEFAULT_SETTINGS.ai.presets,
    },
  }
}

function writeSettings(settings: typeof DEFAULT_SETTINGS) {
  const settingsPath = getSettingsPath()
  if (!settingsPath) return
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => readSettings())

  ipcMain.handle('settings:save', (_e, settings: typeof DEFAULT_SETTINGS) => {
    writeSettings(settings)
  })
}
