import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'

const wasmName = 'sqlite3-app.wasm'

function textFiles(dist: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(js|html|css)$/.test(name)) out.push(path)
    }
  }
  walk(dist)
  return out
}

function pointAtFreshWasm(text: string, hashed: string): string {
  return text
    .split(hashed)
    .join(wasmName)
    .split('`sqlite3.wasm`')
    .join('`sqlite3-app.wasm`')
    .split('"sqlite3.wasm"')
    .join('"sqlite3-app.wasm"')
    .split("'sqlite3.wasm'")
    .join("'sqlite3-app.wasm'")
}

// The worker asks for the content-hashed wasm file. A previous service worker
// stored that exact URL with Content-Type text/plain, and Workbox keeps the
// cached response because the URL did not change. Rename the scripts that
// mention the file so the next service worker has to download them again.
export function publishSqliteWasm(dist: string): void {
  const dir = join(dist, 'assets')
  const hashed = readdirSync(dir).find((name) => /^sqlite3-[A-Za-z0-9_-]+\.wasm$/.test(name))
  if (!hashed) return
  copyFileSync(join(dir, hashed), join(dir, wasmName))

  const assets = `${sep}assets${sep}`
  let pending = new Set<string>()
  for (const path of textFiles(dist)) {
    const text = readFileSync(path, 'utf8')
    const next = pointAtFreshWasm(text, hashed)
    if (next === text) continue
    writeFileSync(path, next)
    if (path.endsWith('.js') && path.includes(assets)) pending.add(basename(path))
  }

  for (let pass = 0; pass < 8 && pending.size > 0; pass += 1) {
    const renames = new Map<string, string>()
    for (const name of pending) {
      const path = join(dir, name)
      if (!existsSync(path)) continue
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8)
      const renamed = name.replace(/-[A-Za-z0-9_-]{8}(?=\.js$)/, `-${digest}`)
      const nextName = renamed === name ? name.replace(/\.js$/, '-appwasm.js') : renamed
      if (nextName === name || existsSync(join(dir, nextName))) continue
      renameSync(path, join(dir, nextName))
      renames.set(name, nextName)
    }
    pending = new Set()
    if (renames.size === 0) return
    for (const path of textFiles(dist)) {
      const text = readFileSync(path, 'utf8')
      let next = text
      for (const [from, to] of renames) next = next.split(from).join(to)
      if (next === text) continue
      writeFileSync(path, next)
      if (path.endsWith('.js') && path.includes(assets)) pending.add(basename(path))
    }
  }
}
