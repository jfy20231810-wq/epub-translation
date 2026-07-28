import { useState } from 'react'
import type { EpubBook, EpubChapter, ParseProgress } from './types'
import { parseEpub } from './utils/epubParser'
import { UploadButton } from './components/UploadButton'
import { ChapterList } from './components/ChapterList'
import { ChapterViewer } from './components/ChapterViewer'
import { SpinnerIcon, AlertIcon, CloseIcon, BookIcon, MenuIcon } from './components/icons'
import './styles/app.css'

export default function App() {
  const [book, setBook] = useState<EpubBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<EpubChapter | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleFileSelected = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setProgress({ stage: 'Starting', percent: 0 })
    setBook(null)
    setSelectedChapter(null)
    setSidebarOpen(false)

    try {
      const parsed = await parseEpub(file, setProgress)
      setBook(parsed)
      if (parsed.chapters.length > 0) {
        setSelectedChapter(parsed.chapters[0])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse the EPUB file.'
      setError(message)
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }

  const handleSelectChapter = (chapter: EpubChapter) => {
    setSelectedChapter(chapter)
    setSidebarOpen(false)
  }

  const handleClearError = () => setError(null)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>
          <div className="logo">
            <BookIcon size={22} />
            <span className="logo-text">AI Translation Studio</span>
            <span className="version-badge">v0.1</span>
          </div>
        </div>
        <div className="header-right">
          {book && (
            <div className="book-info">
              <span className="book-title">{book.title}</span>
              {book.author && book.author !== 'Unknown Author' && (
                <span className="book-author">by {book.author}</span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <UploadButton onFileSelected={handleFileSelected} disabled={isLoading} />
          </div>

          {error && (
            <div className="error-banner">
              <AlertIcon size={16} />
              <span className="error-text">{error}</span>
              <button className="error-close" onClick={handleClearError} aria-label="Dismiss error">
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          {isLoading && progress && (
            <div className="loading-state">
              <div className="loading-spinner"><SpinnerIcon size={24} /></div>
              <div className="loading-stage">{progress.stage}</div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="loading-percent">{progress.percent}%</div>
            </div>
          )}

          {!isLoading && !book && !error && (
            <div className="sidebar-empty">
              <div className="empty-illustration">
                <BookIcon size={40} />
              </div>
              <h3>No book loaded</h3>
              <p>Upload an EPUB file to browse its chapters here.</p>
            </div>
          )}

          {book && !isLoading && (
            <>
              <div className="chapter-count">
                {book.chapters.length} {book.chapters.length === 1 ? 'chapter' : 'chapters'}
              </div>
              <ChapterList
                chapters={book.chapters}
                selectedId={selectedChapter?.id ?? null}
                onSelect={handleSelectChapter}
              />
            </>
          )}
        </aside>

        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <main className="main-panel">
          <ChapterViewer chapter={selectedChapter} bookTitle={book?.title ?? ''} />
        </main>
      </div>
    </div>
  )
}
