import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const home = new URL('.dsh-test-source-check/', root).pathname
mkdirSync(home, { recursive: true })
for (const args of [
  ['--prefix', 'mobile-web-prototype/plugin', 'run', 'check'],
  ['--prefix', 'mobile-host-adapter', 'test'],
]) execFileSync('npm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, DSH_HOME: home } })
