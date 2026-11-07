#!/usr/bin/env node
// Book tool: render the whole book (README, chapters, appendices, labs README) into one
// HTML page for publishing as an Artifact.
// Usage: node tools/build-artifact.mjs <path to marked.esm.js> <output.html>
// Cross-file Markdown links become in-page anchors; links to other repo files
// (labs/, evidence/, tools/) point at the merged repository on GitHub.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [markedPath, outPath] = process.argv.slice(2)
if (!markedPath || !outPath) { console.error('usage: build-artifact.mjs <marked.esm.js> <out.html>'); process.exit(2) }
const { Marked } = await import(pathToFileURL(resolve(markedPath)).href)
const ROOT = resolve(import.meta.dirname, '..')
const REPO = 'https://github.com/vrajkher/DeepSeekHarnessBook/blob/main/'

const VIEWS = [
  ['README.md', 'top', 'શરૂઆત', 'Cover'],
  ['book/overview-samagra-naksho.md', 'overview', 'સમગ્ર નકશો', 'પહેલાં વાંચો'],
  ['story/01-bhojanalay-no-pehlo-divas.md', 'story1', 'હાર્નેસ ભોજનાલયનો પહેલો દિવસ', 'વાર્તા 1'],
  ['book/00-paayo-ane-pratham-run.md', 'ch0', 'પાયો અને પ્રથમ run', 'Level 0'],
  ['book/01-request-ni-musafari.md', 'ch1', 'એક requestની આખી મુસાફરી', 'Level 1'],
  ['book/02-cordis-plugin-architecture.md', 'ch2', 'Cordis અને plugin architecture', 'Level 2'],
  ['book/03-tools-sessions-adapters.md', 'ch3', 'Tools, sessions અને model adapters', 'Level 3'],
  ['book/04-potano-plugin.md', 'ch4', 'પોતાનો plugin બનાવો', 'Level 4'],
  ['book/05-debugging-permissions-reliability.md', 'ch5', 'Debugging, permissions અને reliability', 'Level 5'],
  ['book/06-maintainer-architecture.md', 'ch6', 'Maintainer અને architecture', 'Level 6'],
  ['book/07-antim-project-mastery.md', 'ch7', 'અંતિમ પ્રોજેક્ટ અને mastery', 'Level 7'],
  ['appendix/A-source-index.md', 'appendix-a', 'Source index', 'પરિશિષ્ટ A'],
  ['appendix/B-command-reference.md', 'appendix-b', 'Command reference', 'પરિશિષ્ટ B'],
  ['appendix/C-glossary.md', 'appendix-c', 'ગુજરાતી–English glossary', 'પરિશિષ્ટ C'],
  ['appendix/D-lab-solutions.md', 'appendix-d', 'Lab solutions', 'પરિશિષ્ટ D'],
  ['appendix/E-mastery-rubric.md', 'appendix-e', 'Mastery rubric', 'પરિશિષ્ટ E'],
  ['appendix/F-coverage-map.md', 'appendix-f', 'Coverage map', 'પરિશિષ્ટ F'],
  ['appendix/G-verification-log.md', 'appendix-g', 'Verification log', 'પરિશિષ્ટ G'],
  ['appendix/H-status.md', 'appendix-h', 'Status અને resume notes', 'પરિશિષ્ટ H'],
  ['appendix/citations.generated.md', 'citations', 'Pinned citations', 'Generated'],
  ['labs/README.md', 'labs', 'Book labs', 'Labs'],
]
const viewOf = new Map(VIEWS.map(([file, id]) => [file, id]))
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const anchorId = (view, a) => `${view}-${a.replace(/[^A-Za-z0-9-]/g, '-')}`

function rewriteHref(href, file, view) {
  if (/^(https?:|mailto:)/.test(href)) return { href, external: true }
  const [path, anchor] = href.split('#')
  if (!path) return { href: '#' + (anchor ? anchorId(view, anchor) : view) }
  const target = normalize(relative(ROOT, join(ROOT, dirname(file), path))).replace(/\\/g, '/')
  const tv = viewOf.get(target)
  if (tv) return { href: '#' + (anchor ? anchorId(tv, anchor) : tv) }
  return { href: REPO + target + (anchor ? '#' + anchor : ''), external: true }
}

const sections = []
const toc = []
for (const [file, view, title, eyebrow] of VIEWS) {
  let h = 0
  const heads = []
  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const id = `${view}-h${++h}`
        if (depth === 2) heads.push({ id, text: text.replace(/<[^>]+>/g, '') })
        const level = Math.min(depth + 1, 6)
        return depth === 1
          ? `<h2 class="chapter-title" id="${id}"><span class="eyebrow">${esc(eyebrow)}</span>${text}</h2>\n`
          : `<h${level} id="${id}">${text}</h${level}>\n`
      },
      link({ href, title: t, tokens }) {
        const r = rewriteHref(href, file, view)
        const inner = this.parser.parseInline(tokens)
        return `<a href="${esc(r.href)}"${t ? ` title="${esc(t)}"` : ''}${r.external ? ' rel="noopener"' : ''}>${inner}</a>`
      },
      code({ text, lang }) {
        if (lang === 'mermaid') return `<pre class="mermaid">${esc(text)}</pre>\n`
        return `<div class="code"><pre><code${lang ? ` data-lang="${esc(lang)}"` : ''}>${esc(text)}</code></pre></div>\n`
      },
    },
  })
  let md = readFileSync(join(ROOT, file), 'utf8')
  md = md.replace(/<!-- citations:begin[^]*?<!-- citations:end -->/, m => m.replace(/<!--[^]*?-->/g, ''))
  let html = await marked.parse(md)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
  html = html.replace(/<a id="([^"]+)"><\/a>/g, (_m, a) => `<span class="anchor" id="${anchorId(view, a)}"></span>`)
  sections.push(`<section class="part" id="${view}" aria-labelledby="${view}-h1">\n${html}</section>`)
  toc.push({ view, title, eyebrow, heads })
}

const navItem = t => `<li><a href="#${t.view}" data-view="${t.view}"><span class="nav-eyebrow">${esc(t.eyebrow)}</span><span class="nav-title">${esc(t.title)}</span></a>${
  t.heads.length && (t.view.startsWith('ch') || t.view.startsWith('story') || t.view === 'overview') ? `<ol class="sub">${t.heads.map(x => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join('')}</ol>` : ''}</li>`
const groups = [
  ['પ્રકરણો', toc.filter(t => t.view === 'top' || t.view === 'overview' || t.view.startsWith('story') || t.view.startsWith('ch'))],
  ['પરિશિષ્ટ', toc.filter(t => t.view.startsWith('appendix') || t.view === 'citations' || t.view === 'labs')],
]
const nav = groups.map(([label, items]) => `<p class="nav-group">${label}</p><ol class="nav-list">${items.map(navItem).join('')}</ol>`).join('')

const template = readFileSync(join(ROOT, 'tools', 'artifact-template.html'), 'utf8')
const out = template.replace('<!--NAV-->', nav).replace('<!--BODY-->', sections.join('\n'))
writeFileSync(outPath, out)
console.log(`build-artifact: ${sections.length} parts, ${(out.length / 1024).toFixed(0)} KB -> ${outPath}`)
