/**
 * Собирает автономный HTML: JS и CSS из dist/ вшиваются прямо в страницу.
 *
 * Зачем: такой файл открывается двойным кликом с диска, без сервера и без
 * Node — удобно показать стенд на чужом ноутбуке или отправить файлом.
 * Внешние module-скрипты браузер по file:// не грузит (CORS), а встроенные —
 * выполняет, поэтому всё и приходится инлайнить.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const outDir = join(root, 'dist-standalone')
const outFile = join(outDir, 'kran-monitor.html')

async function readAsset(src) {
  // В index.html пути вида "./assets/index-XXX.js" или "/assets/...".
  const rel = src.replace(/^\.?\//, '')
  return readFile(join(dist, rel), 'utf8')
}

let html = await readFile(join(dist, 'index.html'), 'utf8')

// 1. Стили <link rel="stylesheet" href="..."> → <style>…</style>
const styleLinks = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
for (const [tag] of styleLinks) {
  const href = tag.match(/href="([^"]+)"/)?.[1]
  if (!href || /^https?:/.test(href)) continue // шрифты Google оставляем ссылкой
  const css = await readAsset(href)
  // Замена функцией, а не строкой: в содержимом есть `$`-последовательности,
  // которые String.replace иначе принял бы за шаблоны ($&, $`, $').
  html = html.replace(tag, () => `<style>\n${css}\n</style>`)
}

// 2. Скрипты <script type="module" src="..."> → встроенный модуль
const scriptTags = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)]
for (const [tag, src] of scriptTags) {
  if (/^https?:/.test(src)) continue
  const code = await readAsset(src)
  html = html.replace(tag, () => `<script type="module">\n${code}\n</script>`)
}

// 3. modulepreload больше не нужен — файла рядом не будет
html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/g, '')

// 4. Подсказка о том, что это за файл
html = html.replace(
  '</head>',
  '  <!-- Автономная сборка Crane Monitor: работает с диска, без сервера. -->\n</head>',
)

await mkdir(outDir, { recursive: true })
await writeFile(outFile, html, 'utf8')

const leftovers = (await readdir(dist)).filter(
  (f) => f !== 'index.html' && f !== 'assets' && !f.startsWith('.'),
)
const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
console.log(`Готово: dist-standalone/kran-monitor.html (${kb} КБ)`)
console.log('Откройте файл двойным кликом — сервер не нужен.')
if (leftovers.length)
  console.log('Не вшиты (положите рядом при необходимости):', leftovers.join(', '))
