import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishSqliteWasm } from '../vite/sqliteWasm'

describe('sqlite wasm publish', () => {
  it('points the worker at a wasm url the service worker has never cached', () => {
    const dist = join(tmpdir(), `hak-wasm-${Date.now()}`)
    const assets = join(dist, 'assets')
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(assets, 'sqlite3-TESTHASH.wasm'), 'not-a-real-wasm')
    writeFileSync(join(assets, 'worker-AAAAAAAA.js'), 'fetch("/assets/sqlite3-TESTHASH.wasm");c(`sqlite3.wasm`);this.sqlite3.wasm.allocFromTypedArray(bytes)')
    writeFileSync(join(assets, 'index-BBBBBBBB.js'), 'new Worker("/assets/worker-AAAAAAAA.js");db.sqlite3.wasm.exports')
    writeFileSync(join(dist, 'index.html'), '<script src="/assets/index-BBBBBBBB.js"></script>')

    publishSqliteWasm(dist)

    const files = readdirSync(assets)
    expect(files).toContain('sqlite3-app.wasm')
    expect(files).not.toContain('worker-AAAAAAAA.js')
    expect(files).not.toContain('index-BBBBBBBB.js')
    const worker = files.find((name) => name.startsWith('worker-'))
    const index = files.find((name) => name.startsWith('index-'))
    expect(worker).toBeTruthy()
    expect(index).toBeTruthy()
    expect(readFileSync(join(assets, worker!), 'utf8')).toContain('/assets/sqlite3-app.wasm')
    expect(readFileSync(join(assets, worker!), 'utf8')).not.toContain('sqlite3-TESTHASH.wasm')
    expect(readFileSync(join(assets, worker!), 'utf8')).not.toContain('`sqlite3.wasm`')
    expect(readFileSync(join(assets, worker!), 'utf8')).toContain('this.sqlite3.wasm.allocFromTypedArray')
    expect(readFileSync(join(assets, index!), 'utf8')).toContain('db.sqlite3.wasm.exports')
    expect(readFileSync(join(assets, index!), 'utf8')).toContain(worker)
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain(index)
  })
})
