import { marked } from 'marked'

const files = import.meta.glob('./guides/*.md', { query: '?raw', import: 'default', eager: true })

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }
  const data = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    let val = line.slice(colon + 1).trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim())
    }
    data[key] = val
  }
  return { data, content: match[2] }
}

function slugify(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .trim()
}

function extractTOC(markdown) {
  const toc = []
  for (const line of markdown.split('\n')) {
    const h2 = line.match(/^## (.+)/)
    const h3 = line.match(/^### (.+)/)
    if (h2) toc.push({ level: 2, text: h2[1].trim(), id: slugify(h2[1].trim()) })
    else if (h3) toc.push({ level: 3, text: h3[1].trim(), id: slugify(h3[1].trim()) })
  }
  return toc
}

function renderWithIds(markdown) {
  const html = marked.parse(markdown)
  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (_, level, inner) => {
    const id = slugify(inner)
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

export function getAllGuides() {
  return Object.values(files).map(raw => parseFrontmatter(raw).data)
}

export function getGuideBySlug(slug) {
  for (const raw of Object.values(files)) {
    const { data, content } = parseFrontmatter(raw)
    if (data.slug === slug) {
      return { frontmatter: data, markdown: content, html: renderWithIds(content), toc: extractTOC(content) }
    }
  }
  return null
}

export { renderWithIds, extractTOC }
