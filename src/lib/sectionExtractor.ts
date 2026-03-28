import type * as pdfjsLib from 'pdfjs-dist'
import type { OutlineItem, RawSection } from '../types/pdf'

// pdfjs-dist v5 では TextItem がメインexportにないためローカル定義
interface PdfTextItem {
  str: string
  transform: number[]  // [a, b, c, d, x, y]
  fontName: string
  width: number
  height: number
  hasEOL: boolean
}

const KNOWN_HEADINGS = /^(abstract|introduction|related work|background|preliminaries|methodology|methods?|approach|model|architecture|experiments?|evaluation|results?|discussion|conclusion|conclusions?|future work|limitations?|acknowledgements?|acknowledgments?|references?|appendix|appendices|broader impact|ethics)$/i

const NUMBERED = /^(\d+)(\.\d+)*\.?\s+\S/
const LETTERED = /^[A-Z]\.\s+\S/

export interface TextLine {
  text: string
  fontSize: number
  fontName: string
  pageNum: number
  lineNum: number  // 1-indexed within page
  y: number
}

export interface SectionPosition {
  title: string
  page: number
  line: number
}

function getFontSize(transform: number[]): number {
  return Math.hypot(transform[0], transform[1])
}

/**
 * ページ内のテキストアイテムからカラムセパレーターのx座標を検出する。
 * 1カラムの場合は null を返す。
 */
function detectColumnSeparator(items: PdfTextItem[]): number | null {
  if (items.length < 10) return null

  const xPositions = items.map(i => i.transform[4]).sort((a, b) => a - b)
  const xMin = xPositions[0]
  const xMax = xPositions[xPositions.length - 1]
  const xSpan = xMax - xMin
  if (xSpan < 100) return null

  const middleStart = xMin + xSpan * 0.25
  const middleEnd = xMin + xSpan * 0.75

  let maxGap = 0
  let separatorX: number | null = null

  for (let i = 1; i < xPositions.length; i++) {
    const gap = xPositions[i] - xPositions[i - 1]
    const gapCenter = (xPositions[i] + xPositions[i - 1]) / 2

    if (gapCenter >= middleStart && gapCenter <= middleEnd && gap > maxGap) {
      maxGap = gap
      separatorX = gapCenter
    }
  }

  if (maxGap < xSpan * 0.04 || maxGap < 15) return null

  return separatorX
}

function sortByReadingOrder(items: PdfTextItem[]): PdfTextItem[] {
  const separator = detectColumnSeparator(items)

  if (separator === null) {
    return [...items].sort((a, b) => b.transform[5] - a.transform[5])
  }

  const left = items
    .filter(i => i.transform[4] < separator)
    .sort((a, b) => b.transform[5] - a.transform[5])
  const right = items
    .filter(i => i.transform[4] >= separator)
    .sort((a, b) => b.transform[5] - a.transform[5])

  return [...left, ...right]
}

function groupIntoLines(
  sortedItems: PdfTextItem[],
  pageNum: number
): Omit<TextLine, 'lineNum'>[] {
  if (sortedItems.length === 0) return []

  const lines: Omit<TextLine, 'lineNum'>[] = []
  let currentLine: PdfTextItem[] = [sortedItems[0]]

  for (let i = 1; i < sortedItems.length; i++) {
    const prev = currentLine[currentLine.length - 1]
    const curr = sortedItems[i]
    const yDiff = Math.abs(prev.transform[5] - curr.transform[5])
    const fontSize = getFontSize(prev.transform)

    if (yDiff < fontSize * 0.5) {
      currentLine.push(curr)
    } else {
      lines.push(toLine(currentLine, pageNum))
      currentLine = [curr]
    }
  }
  lines.push(toLine(currentLine, pageNum))
  return lines
}

function toLine(items: PdfTextItem[], pageNum: number): Omit<TextLine, 'lineNum'> {
  const text = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
  const fontSize = Math.max(...items.map(i => getFontSize(i.transform)))
  const fontName = items[0].fontName ?? ''
  const y = items[0].transform[5]
  return { text, fontSize, fontName, pageNum, y }
}

function getBodyFontSize(lines: TextLine[]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    if (line.fontSize < 4) continue
    const key = Math.round(line.fontSize * 2) / 2
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let bodySize = 10
  let max = 0
  for (const [size, count] of counts) {
    if (count > max) { max = count; bodySize = size }
  }
  return bodySize
}

export function getLevel(text: string): number {
  const m = text.match(/^(\d+)((\.\d+)*)/)
  if (!m) return 0
  const dots = (m[2].match(/\./g) ?? []).length
  return Math.min(dots, 2)
}

function isHeading(line: TextLine, bodyFontSize: number): boolean {
  const { text, fontSize } = line
  if (!text || text.length > 100) return false
  if (/^[\d\s,.\+\-±]+$/.test(text)) return false

  if (NUMBERED.test(text) || LETTERED.test(text)) return true
  if (KNOWN_HEADINGS.test(text)) return true
  if (fontSize > bodyFontSize * 1.15 && text.length < 60) return true

  return false
}

function buildTree(flat: OutlineItem[]): OutlineItem[] {
  const result: OutlineItem[] = []
  const stack: OutlineItem[] = []

  for (const item of flat) {
    const node = { ...item, items: [] }
    if (item.level === 0) {
      stack.length = 0
      stack.push(node)
      result.push(node)
    } else if (item.level === 1) {
      const parent = stack[0]
      if (parent) {
        parent.items.push(node)
        stack[1] = node
      } else {
        result.push(node)
      }
    } else {
      const parent = stack[1] ?? stack[0]
      if (parent) {
        parent.items.push(node)
      } else {
        result.push(node)
      }
    }
  }

  return result
}

function sortByReadingOrderForced(items: PdfTextItem[], columns: number): PdfTextItem[] {
  if (columns === 1 || items.length === 0) {
    return [...items].sort((a, b) => b.transform[5] - a.transform[5])
  }
  const xs = items.map(i => i.transform[4])
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2
  const left = items.filter(i => i.transform[4] < midX).sort((a, b) => b.transform[5] - a.transform[5])
  const right = items.filter(i => i.transform[4] >= midX).sort((a, b) => b.transform[5] - a.transform[5])
  return [...left, ...right]
}

/** 指定ページをカラム数を強制して再抽出する */
export async function extractTextLinesForPages(
  pdf: pdfjsLib.PDFDocumentProxy,
  overrides: { page: number; columns: number }[]
): Promise<TextLine[]> {
  const allLines: TextLine[] = []
  for (const { page, columns } of overrides) {
    const pdfPage = await pdf.getPage(page)
    const content = await pdfPage.getTextContent()
    const textItems = content.items
      .filter(item => 'str' in item && (item as PdfTextItem).str.trim().length > 0)
      .map(item => item as PdfTextItem)
    const sorted = sortByReadingOrderForced(textItems, columns)
    const rawLines = groupIntoLines(sorted, page)
    rawLines.forEach((line, idx) => {
      allLines.push({ ...line, lineNum: idx + 1 })
    })
  }
  return allLines
}

/** 全ページのテキストを行単位で抽出し、ページ内行番号を付与して返す */
export async function extractTextLines(pdf: pdfjsLib.PDFDocumentProxy): Promise<TextLine[]> {
  const allLines: TextLine[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const textItems = content.items
      .filter(item => 'str' in item && (item as PdfTextItem).str.trim().length > 0)
      .map(item => item as PdfTextItem)
    const sorted = sortByReadingOrder(textItems)
    const rawLines = groupIntoLines(sorted, i)
    rawLines.forEach((line, idx) => {
      allLines.push({ ...line, lineNum: idx + 1 })
    })
  }

  return allLines
}

/** TextLine[] を [P{page}:L{line}] 付きのテキストに整形してAIに渡す用の文字列を生成する */
export function formatForAI(lines: TextLine[]): string {
  return lines.map(l => `[P${l.pageNum}:L${l.lineNum}] ${l.text}`).join('\n')
}

/** AI返答のSectionPosition[]とTextLine[]からRawSection[]を構築する */
export function buildSectionsFromPositions(
  lines: TextLine[],
  positions: SectionPosition[]
): RawSection[] {
  if (positions.length === 0) return []

  // page → lineNum → globalIndex のルックアップを構築
  const lineIndex = new Map<string, number>()
  for (let i = 0; i < lines.length; i++) {
    lineIndex.set(`${lines[i].pageNum}:${lines[i].lineNum}`, i)
  }

  // pageNum昇順 → lineNum昇順にソート
  const sorted = [...positions].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : a.line - b.line
  )

  const sections: RawSection[] = []
  for (let i = 0; i < sorted.length; i++) {
    const pos = sorted[i]
    const startIdx = lineIndex.get(`${pos.page}:${pos.line}`) ?? -1
    if (startIdx === -1) continue

    const nextPos = sorted[i + 1]
    const endIdx = nextPos
      ? (lineIndex.get(`${nextPos.page}:${nextPos.line}`) ?? lines.length)
      : lines.length

    const contentLines = lines.slice(startIdx, endIdx)
    const content = contentLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim()

    sections.push({
      title: pos.title,
      content,
      pageNumber: pos.page,
      level: getLevel(pos.title),
    })
  }

  return sections
}

/** Markdownテキストからテーブルブロック（|で始まる連続行）を除去する */
function stripMarkdownTables(text: string): string {
  return text
    .split('\n')
    .reduce<{ lines: string[]; inTable: boolean }>((acc, line) => {
      const isTableLine = /^\s*\|/.test(line)
      if (isTableLine) {
        acc.inTable = true
        return acc
      }
      // テーブル直後の空行もスキップ
      if (acc.inTable && line.trim() === '') {
        acc.inTable = false
        return acc
      }
      acc.inTable = false
      acc.lines.push(line)
      return acc
    }, { lines: [], inTable: false })
    .lines.join('\n')
}

/** pymupdf4llm出力（ページ別Markdown）からMarkdown見出しを使ってRawSection[]を構築する */
export function buildSectionsFromMarkdownHeadings(
  pages: { page: number; text: string }[]
): RawSection[] {
  const sortedPages = [...pages].sort((a, b) => a.page - b.page)

  type Heading = { title: string; level: number; page: number; startIdx: number }
  const headings: Heading[] = []

  // 全ページのテキストを結合しながら見出し位置を記録
  let fullText = ''
  for (const p of sortedPages) {
    const pageOffset = fullText.length
    const lines = p.text.split('\n')
    let charOffset = pageOffset
    for (const line of lines) {
      const m = line.match(/^(#{1,6})\s+(.+)$/)
      if (m) {
        headings.push({
          title: m[2].trim().replace(/^\*\*|\*\*$/g, '').trim(),
          // ## → level 0, ### → level 1, #### → level 2
          level: Math.min(Math.max(0, m[1].length - 2), 2),
          page: p.page,
          startIdx: charOffset,
        })
      }
      charOffset += line.length + 1  // +1 for \n
    }
    fullText += p.text + '\n\n'
  }

  if (headings.length === 0) return []

  const sections: RawSection[] = []
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const nextIdx = headings[i + 1]?.startIdx ?? fullText.length
    const content = stripMarkdownTables(fullText.slice(h.startIdx, nextIdx)).trim()
    sections.push({
      title: h.title,
      content,
      pageNumber: h.page,
      level: h.level,
    })
  }

  return sections
}

/** ルールベースセクション抽出（ナビゲーション用・フォールバック用） */
export async function extractSections(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<OutlineItem[]> {
  const allLines = await extractTextLines(pdf)
  const bodyFontSize = getBodyFontSize(allLines)

  const flat: OutlineItem[] = allLines
    .filter(line => isHeading(line, bodyFontSize))
    .map(line => ({
      title: line.text,
      pageNumber: line.pageNum,
      level: getLevel(line.text),
      items: [],
    }))

  return buildTree(flat)
}

/** ルールベースセクション抽出（コンテンツ付き・フォールバック用） */
export async function extractRawSections(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<RawSection[]> {
  const allLines = await extractTextLines(pdf)
  const bodyFontSize = getBodyFontSize(allLines)

  const headingIndices: number[] = []
  for (let i = 0; i < allLines.length; i++) {
    if (isHeading(allLines[i], bodyFontSize)) headingIndices.push(i)
  }

  if (headingIndices.length === 0) return []

  return headingIndices.map((headingIdx, h) => {
    const nextHeadingIdx = headingIndices[h + 1] ?? allLines.length
    const line = allLines[headingIdx]
    const contentLines = allLines.slice(headingIdx + 1, nextHeadingIdx)
    const content = contentLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim()
    return {
      title: line.text,
      content,
      pageNumber: line.pageNum,
      level: getLevel(line.text),
    }
  })
}
