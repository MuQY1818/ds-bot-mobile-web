import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const root = new URL('../', import.meta.url)
const artifacts = new URL('artifacts/', root)
await mkdir(artifacts, { recursive: true })
const output = execFileSync('npm', ['pack', './mobile-web-prototype/plugin', '--json', '--pack-destination', artifacts.pathname], { cwd: root, encoding: 'utf8' })
const [result] = JSON.parse(output)
const sha256 = createHash('sha256').update(await readFile(new URL(result.filename, artifacts))).digest('hex')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== ''
await writeFile(new URL('SHA256SUMS', artifacts), `${sha256}  ${result.filename}\n`)
await writeFile(new URL('release.json', artifacts), JSON.stringify({ name: result.name, version: result.version, commit, dirty, filename: result.filename, sha256 }, null, 2) + '\n')
console.log(JSON.stringify({ filename: result.filename, sha256, commit, dirty }))
if (dirty) throw new Error('Release artifacts require a clean tracked source tree')
