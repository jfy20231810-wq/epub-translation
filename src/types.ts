export interface EpubChapter {
  id: string
  title: string
  href: string
  html: string
  wordCount: number
}

export interface EpubBook {
  title: string
  author: string
  chapters: EpubChapter[]
}

export interface ParseProgress {
  stage: string
  percent: number
}
