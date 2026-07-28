import JSZip from 'jszip'
import type { EpubBook, EpubChapter, ParseProgress } from '../types'

interface TocEntry {
  label: string
  href: string
  level: number
}

interface SpineItem {
  idref: string
  href: string
  mediaType: string
}

const CONTAINER_PATH = 'META-INF/container.xml'

function parseXml(text: string): Document {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) {
    throw new Error('Failed to parse XML: ' + err.textContent)
  }
  return doc
}

function parseHtml(text: string): Document {
  const parser = new DOMParser()
  return parser.parseFromString(text, 'text/html')
}

function getText(node: Node | null): string {
  if (!node) return ''
  return (node.textContent || '').trim()
}

async function loadZip(file: File): Promise<JSZip> {
  return JSZip.loadAsync(file)
}

async function getOpfPath(zip: JSZip): Promise<string> {
  const containerFile = zip.file(CONTAINER_PATH)
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml')
  }
  const containerText = await containerFile.async('string')
  const container = parseXml(containerText)
  const rootfile = container.querySelector('rootfile')
  const fullPath = rootfile?.getAttribute('full-path')
  if (!fullPath) {
    throw new Error('Invalid EPUB: no rootfile in container.xml')
  }
  return fullPath
}

async function readOpf(zip: JSZip, opfPath: string) {
  const opfFile = zip.file(opfPath)
  if (!opfFile) {
    throw new Error('Invalid EPUB: OPF file not found at ' + opfPath)
  }
  const opfText = await opfFile.async('string')
  const opf = parseXml(opfText)

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  const metadata = opf.querySelector('metadata')
  let title = 'Unknown Title'
  let author = 'Unknown Author'
  if (metadata) {
    const titleEl = metadata.querySelector('title')
    if (titleEl && getText(titleEl)) title = getText(titleEl)
    const authorEl = metadata.querySelector('creator')
    if (authorEl && getText(authorEl)) author = getText(authorEl)
  }

  const manifest = new Map<string, SpineItem>()
  const items = opf.querySelectorAll('item')
  items.forEach((item) => {
    const id = item.getAttribute('id') || ''
    const href = item.getAttribute('href') || ''
    const mediaType = item.getAttribute('media-type') || ''
    if (id && href) {
      manifest.set(id, { idref: id, href: decodeURIComponent(href), mediaType })
    }
  })

  const spine: SpineItem[] = []
  const itemrefs = opf.querySelectorAll('spine itemref')
  itemrefs.forEach((ref) => {
    const idref = ref.getAttribute('idref') || ''
    const item = manifest.get(idref)
    if (item) {
      spine.push(item)
    }
  })

  return { title, author, opfDir, manifest, spine }
}

function resolvePath(opfDir: string, href: string): string {
  if (href.startsWith('/')) return href.substring(1)
  return opfDir + decodeURIComponent(href)
}

function stripFragment(href: string): string {
  const i = href.indexOf('#')
  return i >= 0 ? href.substring(0, i) : href
}

async function parseNcx(
  zip: JSZip,
  opfDir: string,
  manifest: Map<string, SpineItem>,
): Promise<TocEntry[]> {
  const ncxItem = Array.from(manifest.values()).find(
    (m) => m.mediaType === 'application/x-dtbncx+xml' || m.href.endsWith('.ncx'),
  )
  if (!ncxItem) return []

  const ncxPath = resolvePath(opfDir, ncxItem.href)
  const ncxFile = zip.file(ncxPath)
  if (!ncxFile) return []

  const ncxText = await ncxFile.async('string')
  const ncx = parseXml(ncxText)
  const entries: TocEntry[] = []

  function walkNavPoint(parent: Element, level: number) {
    const navPoints = Array.from(parent.children).filter((c) => c.tagName.toLowerCase() === 'navpoint')
    navPoints.forEach((np) => {
      const labelEl = np.querySelector('navLabel text')
      const contentEl = np.querySelector('content')
      const label = getText(labelEl)
      const href = contentEl?.getAttribute('src') || ''
      if (label && href) {
        entries.push({ label, href: stripFragment(href), level })
      }
      const children = np.querySelector('navPoint')
      if (children) walkNavPoint(np, level + 1)
    })
  }

  const navMap = ncx.querySelector('navMap')
  if (navMap) walkNavPoint(navMap, 0)

  return entries
}

async function parseNav(
  zip: JSZip,
  opfDir: string,
  manifest: Map<string, SpineItem>,
): Promise<TocEntry[]> {
  const navItem = Array.from(manifest.values()).find(
    (m) => m.mediaType === 'application/xhtml+xml' && m.href.endsWith('.xhtml'),
  )
  if (!navItem) return []

  const navPath = resolvePath(opfDir, navItem.href)
  const navFile = zip.file(navPath)
  if (!navFile) return []

  const navText = await navFile.async('string')
  const doc = parseHtml(navText)
  const entries: TocEntry[] = []

  const nav = doc.querySelector('nav[*|type="toc"], nav.epub-type-toc, nav')
  if (!nav) return []

  const list = nav.querySelector('ol')
  if (!list) return []

  function walkList(ol: Element, level: number) {
    const items = Array.from(ol.children).filter((c) => c.tagName.toLowerCase() === 'li')
    items.forEach((li) => {
      const link = li.querySelector('a')
      if (link) {
        const label = getText(link)
        const href = link.getAttribute('href') || ''
        if (label && href && !href.startsWith('http')) {
          entries.push({ label, href: stripFragment(href), level })
        }
      }
      const nested = li.querySelector('ol')
      if (nested) walkList(nested, level + 1)
    })
  }

  walkList(list, 0)
  return entries
}

function extractTitle(doc: Document): string | null {
  const h1 = doc.querySelector('h1')
  if (h1 && getText(h1)) return getText(h1)
  const h2 = doc.querySelector('h2')
  if (h2 && getText(h2)) return getText(h2)
  const title = doc.querySelector('title')
  if (title && getText(title)) return getText(title)
  return null
}

function cleanHtml(doc: Document): string {
  const body = doc.body || doc.documentElement
  body.querySelectorAll('script, style, link, meta').forEach((el) => el.remove())
  body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on') || attr.name === 'style') {
        el.removeAttribute(attr.name)
      }
    }
  })
  return body.innerHTML
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}

async function readChapterHtml(
  zip: JSZip,
  opfDir: string,
  href: string,
): Promise<string | null> {
  const path = resolvePath(opfDir, href)
  const file = zip.file(path)
  if (!file) return null
  const text = await file.async('string')
  return text
}

function buildChapterFromToc(
  toc: TocEntry[],
  spine: SpineItem[],
): Array<{ entry: TocEntry; spineItem: SpineItem | null }> {
  const spineHrefs = new Set(spine.map((s) => decodeURIComponent(s.href)))
  const result: Array<{ entry: TocEntry; spineItem: SpineItem | null }> = []

  for (const entry of toc) {
    const entryPath = entry.href
    let matchedSpine: SpineItem | null = null
    for (const s of spine) {
      const sPath = decodeURIComponent(s.href)
      if (sPath === entryPath || entryPath.endsWith(sPath) || sPath.endsWith(entryPath)) {
        matchedSpine = s
        break
      }
    }
    if (!matchedSpine && spineHrefs.size > 0) {
      // try partial match
      for (const s of spine) {
        const sPath = decodeURIComponent(s.href)
        const sBase = sPath.split('/').pop() || sPath
        const eBase = entryPath.split('/').pop() || entryPath
        if (sBase === eBase) {
          matchedSpine = s
          break
        }
      }
    }
    result.push({ entry, spineItem: matchedSpine })
  }

  return result
}

export async function parseEpub(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<EpubBook> {
  onProgress?.({ stage: 'Opening archive', percent: 5 })
  const zip = await loadZip(file)

  onProgress?.({ stage: 'Reading manifest', percent: 15 })
  const opfPath = await getOpfPath(zip)
  const { title, author, opfDir, manifest, spine } = await readOpf(zip, opfPath)

  onProgress?.({ stage: 'Reading table of contents', percent: 30 })
  let toc = await parseNav(zip, opfDir, manifest)
  if (toc.length === 0) {
    toc = await parseNcx(zip, opfDir, manifest)
  }

  onProgress?.({ stage: 'Extracting chapters', percent: 45 })
  const chapters: EpubChapter[] = []

  if (toc.length > 0) {
    const matched = buildChapterFromToc(toc, spine)
    let idx = 0
    for (const { entry, spineItem } of matched) {
      const targetHref = spineItem ? decodeURIComponent(spineItem.href) : entry.href
      const html = await readChapterHtml(zip, opfDir, targetHref)
      if (html) {
        const doc = parseHtml(html)
        const chapterTitle = entry.label || extractTitle(doc) || `Chapter ${idx + 1}`
        const cleaned = cleanHtml(doc)
        chapters.push({
          id: `ch-${idx}`,
          title: chapterTitle,
          href: targetHref,
          html: cleaned,
          wordCount: countWords(cleaned),
        })
      }
      idx++
      onProgress?.({
        stage: `Extracting chapter ${idx} of ${matched.length}`,
        percent: 45 + Math.round((idx / matched.length) * 50),
      })
    }
  } else {
    // No TOC found - treat each spine item as a chapter
    let idx = 0
    const htmlItems = spine.filter(
      (s) => s.mediaType === 'application/xhtml+xml' || s.href.endsWith('.html') || s.href.endsWith('.xhtml'),
    )
    for (const item of htmlItems) {
      const href = decodeURIComponent(item.href)
      const html = await readChapterHtml(zip, opfDir, href)
      if (html) {
        const doc = parseHtml(html)
        const chapterTitle = extractTitle(doc) || `Chapter ${idx + 1}`
        const cleaned = cleanHtml(doc)
        if (getText(doc.body)) {
          chapters.push({
            id: `ch-${idx}`,
            title: chapterTitle,
            href,
            html: cleaned,
            wordCount: countWords(cleaned),
          })
        }
      }
      idx++
      onProgress?.({
        stage: `Extracting chapter ${idx} of ${htmlItems.length}`,
        percent: 45 + Math.round((idx / htmlItems.length) * 50),
      })
    }
  }

  if (chapters.length === 0) {
    throw new Error('No chapters could be extracted from this EPUB file.')
  }

  onProgress?.({ stage: 'Finalizing', percent: 100 })
  return { title, author, chapters }
}
