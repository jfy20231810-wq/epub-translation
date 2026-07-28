import { useEffect, useRef } from 'react'

interface ChapterContentProps {
  html: string
}

export function ChapterContent({ html }: ChapterContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Sanitize: remove event handlers and javascript: URLs
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT)
    const toClean: Element[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node instanceof Element) toClean.push(node)
    }
    toClean.forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
        if (attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name)
        }
      }
    })
  }, [html])

  return (
    <div className="chapter-content" ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
