import type { EpubChapter } from '../types'
import { ChapterContent } from './ChapterContent'

interface ChapterViewerProps {
  chapter: EpubChapter | null
  bookTitle: string
}

export function ChapterViewer({ chapter, bookTitle }: ChapterViewerProps) {
  if (!chapter) {
    return (
      <div className="viewer-empty">
        <div className="viewer-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
          </svg>
        </div>
        <h2>Select a chapter</h2>
        <p>Choose a chapter from the list to start reading.</p>
      </div>
    )
  }

  return (
    <div className="viewer">
      <div className="viewer-header">
        <div className="viewer-breadcrumb">{bookTitle}</div>
        <h1 className="viewer-title">{chapter.title}</h1>
        <div className="viewer-meta">{chapter.wordCount.toLocaleString()} words</div>
      </div>
      <ChapterContent html={chapter.html} />
    </div>
  )
}
