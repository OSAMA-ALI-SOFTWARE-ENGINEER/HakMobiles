import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export default function globalSetup() {
  const here = dirname(fileURLToPath(import.meta.url))
  execFileSync('php', [resolve(here, 'reset-admin-2fa.php')], { stdio: 'inherit' })
}
