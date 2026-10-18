import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '../ds-bot-upstream/ds-bot/dev/harness/node_modules/@deepseek-ai/cordis/lib/index.js'
import { HostConnectionService } from '../ds-bot-upstream/ds-bot/dev/harness/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js'
import { install as installChannel } from '../ds-bot-upstream/ds-bot/src/host/channel.js'
import * as plugin from './index.mjs'
import { createMobileClient } from './client.mjs'

async function fixture(t) {
  const ctx = new Context()
  const fiber = await ctx.plugin({ name: 'fixture-connection', apply(ctx) {
    new HostConnectionService(ctx, [], { isAuthenticated: () => false })
  } })
  t.after(() => fiber.dispose())
  const state = { revision: 1, mainBotIds: ['chief'], bots: { chief: { id: 'chief', name: 'Chief', segments: [] } },
    rooms: { group: { id: 'group', name: 'Group', sessions: { chief: 'hidden' }, log: [] } },
    agents: {}, questions: {}, exchangeTurns: {}, prefs: {} }
  let current = 'current'
  const prompts = []
  const noop = () => {}
  const rt = { state, refresh: noop, bootstrap: noop, catalog: noop, loadSecrets: noop, load: noop,
    readOnly: () => undefined, chatOf: () => current, cachedCatalog: () => [], cachedDefault: noop,
    secretsView: () => [], capabilityLibraryView: () => [], activityView: () => ({}), workView: () => ({}),
    roomWorkView: () => ({}), approvalsView: () => [], memoryNews: () => ({}), memoryReviews: () => [],
    connectorsView: () => [], capabilityStatusesView: () => ({}), pastOwners: new Map(), botOf: () => false,
    ensureCapabilities: noop, roomProgress: new Map([['relay-call', { roomId: 'group', replies: [{ botId: 'chief', name: 'Chief', text: 'Fixture reply' }], speaking: 'chief' }]]),
    chatPage: async id => ({ items: [{ text: 'Canonical fixture' }], botId: id }),
    noteFailure: () => assert.fail('Unexpected internal error') }
  const channel = await ctx.plugin({ name: 'fixture-team', inject: ['connection'], apply(ctx) {
    // Inject only the documented controller operation used by upstream send.
    const scope = Object.create(ctx)
    Object.defineProperty(scope, 'sessionController', { value: { prompt: async value => prompts.push(value) } })
    installChannel({ ...rt, ctx: scope })
  } })
  t.after(() => channel.dispose())
  const adapter = await ctx.plugin(plugin)
  t.after(() => adapter.dispose())
  const dispatcher = ctx.connection.createSharedFetchHandler('/api')
  const peer = ctx.connection.createPeer?.({ principal: { kind: 'owner' } })
  t.after(() => peer?.dispose())
  const fetch = async (url, init) => dispatcher.fetch(new Request(url, init), peer)
  return { fetch, prompts, move: () => { current = 'next'; state.revision++ }, stop: () => adapter.dispose() }
}

test('incremental unchanged state retains conversation ownership and live fields', async () => {
  let reads = 0
  const api = client(async () => Response.json({ ok: true, value: ++reads === 1
    ? { revision: 1, modelsKey: 'a', bots: [{ id: 'chief', sessionId: 'current' }], rooms: [] }
    : { revision: 1, unchanged: true, work: { bots: { chief: 'working' } } } }))
  await api.refresh()
  const state = await api.refresh()
  assert.equal(state.bots[0].sessionId, 'current')
  assert.equal(state.work.bots.chief, 'working')
})

test('internal send failure conservatively retains uncertain draft', async () => {
  const api = client(async (url, init) => Response.json(JSON.parse(init.body).endpoint === 'state'
    ? { ok: true, value: { revision: 1, bots: [{ id: 'chief', sessionId: 'current' }], rooms: [] } }
    : { ok: false, error: { code: 'bot/internal', message: 'Fixture error after possible admission' } }))
  await assert.rejects(api.sendText('chief', 'Inspect first'), { code: 'mobile/send-unknown' })
  assert.equal(api.submission('chief').phase, 'unknown')
})

test('read-only team rejects send before controller admission', async () => {
  let sends = 0
  const api = client(async (url, init) => {
    if (JSON.parse(init.body).endpoint === 'send') sends++
    return Response.json({ ok: true, value: { revision: 1, readOnly: 'Fixture lock', bots: [{ id: 'chief', sessionId: 'current' }], rooms: [] } })
  })
  await assert.rejects(api.sendText('chief', 'Hello'), { code: 'bot/read-only' })
  assert.equal(sends, 0)
})

const client = fetch => createMobileClient({ appRoot: 'http://fixture.invalid/', fetch })

test('real upstream route lists existing identities and reads canonical Bot chat', async t => {
  const f = await fixture(t)
  const api = client(f.fetch)
  assert.deepEqual(await api.conversations(), [
    { id: 'chief', name: 'Chief', kind: 'bot', sessionId: 'current' },
    { id: 'group', name: 'Group', kind: 'room', sessionId: 'group' },
  ])
  assert.equal((await api.history('chief')).botId, 'chief')
  await assert.rejects(api.target('hidden'), { code: 'mobile/not-found' })
  await assert.rejects(api.history('group'), { code: 'mobile/stream-required' })
  f.move()
  assert.equal((await api.target('chief')).sessionId, 'next')
})

test('group progress uses upstream round replies and excludes Bot conversations', async t => {
  const f = await fixture(t)
  const api = client(f.fetch)
  const progress = await api.roomProgress('group')
  assert.equal(progress[0].callId, 'relay-call')
  assert.equal(progress[0].replies[0].text, 'Fixture reply')
  assert.equal(progress[0].speaking, 'chief')
  await assert.rejects(api.roomProgress('chief'), { code: 'mobile/not-room' })
})

test('text send delegates to upstream current Session and group Session', async t => {
  const f = await fixture(t)
  const api = client(f.fetch)
  f.move()
  assert.deepEqual(await api.sendText('chief', 'Hello'), { accepted: true, sessionId: 'next' })
  await api.sendText('group', 'Group hello')
  assert.deepEqual(f.prompts.map(item => item.sessionId), ['next', 'group'])
  assert.equal(f.prompts[0].content[0].text, 'Hello')
  assert.notEqual(f.prompts[0].requestId, f.prompts[1].requestId)
})

test('lost acknowledgement never retries and blocks accidental resend until explicit resolution', async t => {
  const f = await fixture(t)
  const api = client(async (url, init) => {
    const response = await f.fetch(url, init)
    if (JSON.parse(init.body).endpoint === 'send') throw new TypeError('Simulated lost response')
    return response
  })
  await assert.rejects(api.sendText('chief', 'Keep draft'), { code: 'mobile/send-unknown' })
  assert.deepEqual(api.submission('chief'), { phase: 'unknown', text: 'Keep draft' })
  await api.refresh()
  await assert.rejects(api.sendText('chief', 'Keep draft'), { code: 'mobile/pending' })
  assert.equal(f.prompts.length, 1)
  api.acknowledgeUnknown('chief')
  assert.equal(api.submission('chief'), undefined)
})

test('plugin registers authenticated shared routes and removes both on disposal', async t => {
  const f = await fixture(t)
  const response = await f.fetch('http://fixture.invalid/api/mobile-host/describe')
  assert.equal((await response.json()).durableDeduplication, false)
  const module = await f.fetch('http://fixture.invalid/api/mobile-host/client.mjs')
  assert.match(await module.text(), /export function createMobileClient/)
  await f.stop()
  assert.equal((await f.fetch('http://fixture.invalid/api/mobile-host/describe')).status, 404)
})

test('browser authentication refusal is preserved and sends no prompt', async t => {
  const f = await fixture(t)
  const api = client(async () => new Response('', { status: 401 }))
  await assert.rejects(api.sendText('chief', 'Hello'), { code: 'HTTP_401' })
  assert.equal(f.prompts.length, 0)
  assert.equal(api.submission('chief'), undefined)
})

test('DSH mount roots stay document-independent and reject credential-bearing URLs', async () => {
  assert.throws(() => createMobileClient({ appRoot: 'https://example.invalid/?token=fixture' }), { code: 'mobile/invalid-root' })
  let requested
  const api = createMobileClient({ appRoot: 'https://example.invalid/mount/', fetch: async (url, init) => {
    requested = { url: String(url), credentials: init.credentials }
    return Response.json({ ok: true, value: { revision: 1, bots: [], rooms: [] } })
  } })
  await api.refresh()
  assert.deepEqual(requested, { url: 'https://example.invalid/mount/api/bot', credentials: 'same-origin' })
})
