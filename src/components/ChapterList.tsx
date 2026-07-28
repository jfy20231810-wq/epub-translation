import type { EpubChapter } from '../types'

interface ChapterListProps {
  chapters: EpubChapter[]
  selectedId: string | null
  onSelect: (chapter: EpubChapter) => void
}

export function ChapterList({ chapters, selectedId, onSelect }: ChapterListProps) {
  return (
    <div className="chapter-list">
      {chapters.map((chapter, index) => (
        <button
          key={chapter.id}
          className={`chapter-item ${selectedId === chapter.id ? 'selected' : ''}`}
          onClick={() => onSelect(chapter)}
        >
          <span className="chapter-number">{index + 1}</span>
          <span className="chapter-title">{chapter.title}</span>
          <span className="chapter-words">{chapter.wordCount.toLocaleString()}w</span>
        </button>
      ))}
    </div>
  )
}
