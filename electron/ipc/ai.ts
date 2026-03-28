import { ipcMain, WebContents } from 'electron'
import OpenAI from 'openai'
import { readSettings } from './settings'

function makeClient(cfg: { baseUrl: string; apiKey: string }) {
  return new OpenAI({
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey || 'no-key',
  })
}

function getPreset(presetId: string) {
  const settings = readSettings()
  const presets = settings.ai.presets
  return presets.find((p: { id: string }) => p.id === presetId)
    ?? presets.find((p: { isDefault: boolean }) => p.isDefault)
    ?? presets[0]
}

function classifyError(err: unknown): string {
  const msg = String(err)
  if (/ECONNREFUSED|ETIMEDOUT|fetch failed|APIConnectionError|network/i.test(msg)) return 'connection_error'
  if (/AuthenticationError|status 401|Incorrect API key|invalid_api_key/i.test(msg)) return 'auth_error'
  if (/RateLimitError|status 429/i.test(msg)) return 'rate_limit'
  if (/context_length_exceeded|maximum context length|n_ctx|context window/i.test(msg)) return 'context_overflow'
  return 'unknown_error'
}

async function streamToRenderer(
  webContents: WebContents,
  id: string,
  stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
) {
  let model = ''
  try {
    for await (const chunk of stream) {
      if (!model && chunk.model) model = chunk.model
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) webContents.send('ai:chunk', id, text)
      if (chunk.choices[0]?.finish_reason === 'length') {
        webContents.send('ai:done', id, 'length_limit', model || null)
        return
      }
    }
    webContents.send('ai:done', id, null, model)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      webContents.send('ai:done', id, null, null)
    } else {
      webContents.send('ai:done', id, classifyError(err), null)
    }
  }
}

const abortControllers = new Map<string, AbortController>()

export function registerAiHandlers() {
  ipcMain.handle('ai:abort', (_, id: string) => {
    abortControllers.get(id)?.abort()
    abortControllers.delete(id)
  })
  // 翻訳
  ipcMain.handle('ai:translate', async (event, { id, text, targetLanguage, presetId }: {
    id: string
    text: string
    targetLanguage: string
    presetId: string
  }) => {
    try {
      const preset = getPreset(presetId)
      const client = makeClient(preset)
      const stream = await client.chat.completions.create({
        model: preset.model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are a professional academic translator. Translate the following text into ${targetLanguage}. Translate every sentence completely without summarizing or omitting any content. Format the output in Markdown. Use headings for sections that appear to be headings in the original text. Do not use lists or bullet points unless they are explicitly used in the original text.

The input will be Markdown extracted using pymupdf4llm. Therefore, it may contain noise such as page numbers, header and footer text, isolated numbers or symbols, benchmark table values, figure and table captions, and text embedded within figures (picture text). These should be skipped, and you should focus on translating the meaningful academic body text.

Additionally, if you encounter what appears to be the body of a table (such as rows composed of numbers, symbols, or pipe-separated values), you must skip that entire portion.

For mathematical expressions, always use KaTeX-compatible delimiters: $...$ for inline math and $$...$$ for display (block) math. Do not use \\(...\\) or \\[...\\] notation.`,
          },
          { role: 'user', content: text },
        ],
      })
      streamToRenderer(event.sender, id, stream)
    } catch (err) {
      event.sender.send('ai:done', id, classifyError(err), null)
    }
  })

  // チャット
  ipcMain.handle('ai:chat', async (event, { id, messages, context, presetId }: {
    id: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    context: string
    presetId: string
  }) => {
    try {
      const preset = getPreset(presetId)
      const client = makeClient(preset)
      const controller = new AbortController()
      abortControllers.set(id, controller)
      const stream = await client.chat.completions.create({
        model: preset.model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for reading academic papers. Answer questions based on the following paper content:\n\n${context}\n\nFor mathematical expressions, always use KaTeX-compatible delimiters: $...$ for inline math and $$...$$ for display (block) math. Do not use \\(...\\) or \\[...\\] notation.`,
          },
          ...messages,
        ],
      }, { signal: controller.signal })
      streamToRenderer(event.sender, id, stream).finally(() => abortControllers.delete(id))
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        event.sender.send('ai:done', id, null, null)
      } else {
        event.sender.send('ai:done', id, classifyError(err), null)
      }
    }
  })
}
