import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createMobileClient} from './client.mjs'

function atLocation(t, href) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location')
  Object.defineProperty(globalThis, 'location', {configurable: true, value: new URL(href)})
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'location', descriptor)
    else delete globalThis.location
  })
}

test('Desktop keeps Bot requests on its authenticated dsh-app carrier', async t => {
  atLocation(t, 'dsh-app://app/')
  let request
  const api = createMobileClient({appRoot: 'dsh-app://app/', fetch: async (url, init) => {
    request = {url: String(url), credentials: init.credentials, redirect: init.redirect}
    return Response.json({ok: true, value: {revision: 1, bots: [], rooms: []}})
  }})
  await api.refresh()
  assert.deepEqual(request, {url: 'dsh-app://app/api/bot', credentials: 'same-origin', redirect: 'error'})
})

test('Desktop exception refuses other documents, ports and credential-bearing roots', () => {
  for (const appRoot of ['dsh-app://other/', 'dsh-app://app:18788/', 'dsh-app://app/nested/',
    'dsh-app://user:password@app/', 'dsh-app://app/?token=fixture', 'dsh-app://app/#fixture', 'file:///']) {
    assert.throws(() => createMobileClient({appRoot}), {code: 'mobile/invalid-root'})
  }
})

test('custom-scheme origins cannot bypass same-origin checks through a null origin', t => {
  atLocation(t, 'dsh-app://other/')
  assert.throws(() => createMobileClient({appRoot: 'dsh-app://app/'}), {code: 'mobile/cross-origin'})
})

test('a Web page cannot select the Desktop carrier', t => {
  atLocation(t, 'https://example.invalid/')
  assert.throws(() => createMobileClient({appRoot: 'dsh-app://app/'}), {code: 'mobile/cross-origin'})
})
