import { useRef, useState, type DragEvent } from 'react'
import { UploadIcon } from './icons'

interface UploadButtonProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export function UploadButton({ onFileSelected, disabled }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      onFileSelected(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className={`upload-btn ${isDragging ? 'dragging' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled}
      >
        <UploadIcon />
        <span>Upload EPUB</span>
      </button>
    </>
  )
}
