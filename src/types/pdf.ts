export interface OutlineItem {
  title: string
  pageNumber: number
  level: number
  items: OutlineItem[]
}

export interface RawSection {
  title: string
  content: string
  pageNumber: number
  level: number
  translation?: string
  translationModel?: string
  translationDate?: string
}
