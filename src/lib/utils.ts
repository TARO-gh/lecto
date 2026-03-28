import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// \[...\] → $$...$$、\(...\) → $...$ に変換してremark-mathで認識できるようにする
export function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$').replace(/\\\)/g, '$')
}
