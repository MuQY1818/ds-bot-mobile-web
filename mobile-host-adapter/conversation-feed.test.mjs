import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openConversationFeed } from './conversation-feed.mjs'

function source(initial) {
  let value = initial
  const listeners = new Set()
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    set(next) { value = next; for (const fn of [...listeners]) fn() }, count: () => listeners.size }
}
function fixture({ deferred = false } = {}) {
  const a = source({ key: 'a', kind: 'assistant-step', visibility: 'visible', data: { blocks: [] } })
  const hidden = source({ key: 'hidden', visibility: 'hidden' })
  const nodes = new Map([['a', a], ['hidden', hidden]])
  const chat = source({ order: ['a', 'hidden'], nodes: { get: key => nodes.get(key)?.getSnapshot(), source: key => nodes.get(key) } })
  const session = source({ openState: 'open', hasMore: true, loadingOlder: false })
  let older = 0
  session.loadOlder = async () => { older++; chat.set({ ...chat.getSnapshot(), order: ['a'] }) }
  let target = { id: 'group', kind: 'room', sessionId: 'group' }
  let released = 0
  let refreshes = 0
  let finish
  const ready = deferred ? new Promise(resolve => { finish = resolve }) : Promise.resolve()
  const binding = { session }
  const retained = []
  const ctx = { sessions: {
    retain(id, options) { retained.push({ id, source: options.source }); return { binding, ready, release() { released++ } } },
    refresh: async () => { refreshes++ },
  }, uiConversation: { binding: value => { assert.equal(value, binding); return { target: name => { assert.equal(name, 'chat'); return chat } } } } }
  const api = { target: async () => target }
  return { ctx, api, a, hidden, chat, session, retained, finish: () => finish?.(), older: () => older,
    released: () => released, refreshes: () => refreshes, move: () => { target = { ...target, sessionId: 'new' } } }
}

test('group uses its public Session, publishes history and tracks keyed streaming deltas', async () => {
  const f = fixture()
  const updates = []
  const feed = await openConversationFeed({ ...f, conversationId: 'group', onUpdate: value => updates.push(value) })
  assert.deepEqual(f.retained, [{ id: 'group', source: 'mobileHostView' }])
  assert.equal(updates.at(-1).nodes.length, 1)
  f.a.set({ ...f.a.getSnapshot(), data: { blocks: [{ type: 'text', text: 'stream delta' }] } })
  assert.equal(updates.at(-1).nodes[0].data.blocks[0].text, 'stream delta')
  await feed.loadOlder()
  assert.equal(f.older(), 1)
  assert.equal(f.hidden.count(), 0)
  feed.close()
  feed.close()
  assert.equal(f.released(), 1)
  assert.equal(f.a.count() + f.chat.count() + f.session.count(), 0)
})

test('foreground refresh retains existing stream; rollover requires explicit reopen', async () => {
  const f = fixture()
  const feed = await openConversationFeed({ ...f, conversationId: 'group', onUpdate() {} })
  await feed.refresh()
  assert.equal(f.refreshes(), 1)
  assert.equal(f.retained.length, 1)
  f.move()
  await assert.rejects(feed.refresh(), { code: 'mobile/session-changed' })
  feed.close()
})

test('abort during pending history acquisition releases before readiness and never publishes', async () => {
  const f = fixture({ deferred: true })
  const controller = new AbortController()
  let updates = 0
  const opening = openConversationFeed({ ...f, conversationId: 'group', signal: controller.signal, onUpdate() { updates++ } })
  await Promise.resolve()
  controller.abort()
  assert.equal(f.released(), 1)
  f.finish()
  await assert.rejects(opening, { name: 'AbortError' })
  assert.equal(updates, 0)
  assert.equal(f.released(), 1)
})

test('standalone page without public DSH services fails explicitly', async () => {
  await assert.rejects(openConversationFeed({ ctx: {}, api: {}, conversationId: 'group', onUpdate() {} }), { code: 'mobile/client-services-required' })
})
