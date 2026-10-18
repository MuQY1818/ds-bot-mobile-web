import { readFile } from 'node:fs/promises'
export const BENCH_ORIGIN = 'http://127.0.0.1:3298'
const LOG = new URL('./.dsh-test-mobile/web.log', import.meta.url)

// Only the isolated fixture log is read. No cookie/token is returned or printed.
export async function loginBench(page) {
  const text = await readFile(LOG, 'utf8')
  const launch = text.match(/http:\/\/127\.0\.0\.1:3298\/\?token=[^\s]+/)?.[0]
  if (!launch) throw new Error('Fixture login is not ready')
  const response = await fetch(launch, { redirect: 'manual' })
  const cookies = response.headers.getSetCookie()
  if (![302, 303].includes(response.status) || cookies.length === 0) throw new Error('Fixture authentication exchange failed')
  for (const cookie of cookies) {
    const pair = cookie.split(';', 1)[0]
    const separator = pair.indexOf('=')
    const result = await page.cdp('Network.setCookie', {
      url: BENCH_ORIGIN + '/', name: pair.slice(0, separator), value: pair.slice(separator + 1),
      httpOnly: true, sameSite: 'Strict', secure: false,
    })
    if (result?.success === false) throw new Error('Fixture browser login could not be applied')
  }
  await page.goto(BENCH_ORIGIN + '/')
  return { authenticated: true, origin: BENCH_ORIGIN }
}

export async function benchApi(endpoint, payload = {}) {
  const text = await readFile(LOG, 'utf8')
  const launch = text.match(/http:\/\/127\.0\.0\.1:3298\/\?token=[^\s]+/)?.[0]
  if (!launch) throw new Error('Fixture login is not ready')
  const admission = await fetch(launch, { redirect: 'manual' })
  const cookie = admission.headers.getSetCookie().map(item => item.split(';', 1)[0]).join('; ')
  if (!cookie) throw new Error('Fixture login returned no cookie')
  const response = await fetch(BENCH_ORIGIN + '/api/bot', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint, payload }),
  })
  const result = await response.json()
  if (!result.ok) throw new Error('Fixture team request refused: ' + endpoint)
  return result.value
}
