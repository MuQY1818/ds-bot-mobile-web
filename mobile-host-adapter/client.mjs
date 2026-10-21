import {readOperation} from './read-operation.mjs'
const failure = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra })

// appRoot is the DSH mount root, not the mobile page's directory.
// This module never accepts launch tokens and never reads browser cookies.
export function createMobileClient({ appRoot, fetch: request = globalThis.fetch, readTimeoutMs=12000 } = {}) {
  const root = new URL(appRoot)
  const desktopRoot = root.protocol === 'dsh-app:' && root.hostname === 'app' && root.port === '' && root.pathname === '/'
  if ((!['http:', 'https:'].includes(root.protocol) && !desktopRoot) || root.username || root.password || root.search || root.hash || !root.pathname.endsWith('/')) {
    throw failure('mobile/invalid-root', 'Expected the clean DSH application root URL')
  }
  if (globalThis.location && (root.protocol !== globalThis.location.protocol || root.host !== globalThis.location.host)) {
    throw failure('mobile/cross-origin', 'Mobile UI and DSH must share an origin')
  }
  const route = new URL('api/bot', root)
  let state
  let issued = 0
  let applied = 0
  let stateRequest
  const submissions = new Map()

  async function call(endpoint, payload, signal) {
    signal?.throwIfAborted()
    let response
    try {
      response = await request(route, { method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint, payload }), signal })
    } catch (cause) {
      throw failure('mobile/transport', 'Connection interrupted', { cause, uncertain: true })
    }
    if (!response.ok) throw failure(`HTTP_${response.status}`, 'DSH request failed', {
      uncertain: ![400, 401, 403, 404, 405, 413].includes(response.status),
    })
    let result
    try { result = await response.json() } catch {
      throw failure('mobile/invalid-response', 'DSH response could not be read', { uncertain: true })
    }
    if (result?.ok === false) throw failure(result.error?.code ?? 'bot/refused', result.error?.message ?? 'DS Bot refused the request', {
      uncertain: endpoint === 'send' && result.error?.code === 'bot/internal',
    })
    if (result?.ok !== true) throw failure('mobile/invalid-response', 'Unexpected DS Bot response', { uncertain: true })
    return result.value
  }

  async function refresh(signal) {
    signal?.throwIfAborted()
    if (!stateRequest) {
      const request = { controller: new AbortController(), readers: 0, settled: false }
      const order = ++issued
      stateRequest = request
      request.promise = (async () => {
        const value = await readOperation(signal=>call('state', state ? { since: state.revision, models: state.modelsKey } : {}, signal),{signal:request.controller.signal,timeoutMs:readTimeoutMs})
        request.controller.signal.throwIfAborted()
        if (order < applied) return state
        if (!value || (!value.unchanged && (!Array.isArray(value.bots) || !Array.isArray(value.rooms)))) {
          throw failure('mobile/invalid-state', 'Unsupported team state')
        }
        if (value.unchanged && !state) throw failure('mobile/invalid-state', 'Missing initial team state')
        applied = order
        state = value.unchanged ? { ...state, ...value } : value
        return state
      })().catch(error => {
        if (!request.controller.signal.aborted && order >= applied && ['HTTP_401', 'HTTP_403'].includes(error.code)) {
          state = undefined
          applied = order
        }
        throw error
      }).finally(() => {
        request.settled = true
        if (stateRequest === request) stateRequest = undefined
      })
    }
    const request = stateRequest
    request.readers++
    // Share only an in-flight authenticated state read. No completed response is
    // used to skip a later target's identity check, and one cancelled navigation
    // cannot abort a roster refresh that is still waiting for the same response.
    return new Promise((resolve, reject) => {
      let active = true
      const finish = (settle, value) => {
        if (!active) return
        active = false
        signal?.removeEventListener('abort', cancel)
        request.readers--
        if (!request.readers && !request.settled) {
          if (stateRequest === request) stateRequest = undefined
          request.controller.abort()
        }
        settle(value)
      }
      const cancel = () => finish(reject, signal.reason)
      signal?.addEventListener('abort', cancel, { once: true })
      request.promise.then(value => finish(resolve, value), error => finish(reject, error))
      if (signal?.aborted) cancel()
    })
  }

  async function target(id, signal) {
    const view = await refresh(signal)
    const bot = view.bots.find(item => item.id === id)
    if (bot) return { id, kind: 'bot', name: bot.name, sessionId: bot.sessionId }
    const room = view.rooms.find(item => item.id === id)
    if (room) return { id, kind: 'room', name: room.name, sessionId: room.id }
    throw failure('mobile/not-found', 'Conversation no longer exists')
  }

  return Object.freeze({
    refresh,
    async conversations(signal) {
      const view = await refresh(signal)
      return [...view.bots.map(item => ({ id: item.id, name: item.name, kind: 'bot', sessionId: item.sessionId })),
        ...view.rooms.map(item => ({ id: item.id, name: item.name, kind: 'room', sessionId: item.id }))]
    },
    target,
    async history(id, cursor, signal) {
      const item = await target(id, signal)
      if (item.kind === 'room') throw failure('mobile/stream-required', 'Group history uses the DSH Session conversation projection')
      return call('chat', { botId: item.id, cursor: cursor ?? null }, signal)
    },
    async roomProgress(id, signal) {
      const item = await target(id, signal)
      if (item.kind !== 'room') throw failure('mobile/not-room', 'Group progress requires a group conversation')
      return call('room-progress', { roomId: item.id }, signal)
    },
    async sendText(id, text, { signal } = {}) {
      if (typeof text !== 'string' || !text.trim()) throw failure('mobile/empty', 'Enter a message')
      if (submissions.has(id)) throw failure('mobile/pending', 'Inspect the pending submission before sending again')
      submissions.set(id, { phase: 'checking', text })
      let dispatched = false
      try {
        const item = await target(id, signal)
        if (state.readOnly != null) throw failure('bot/read-only', 'The team is read-only')
        signal?.throwIfAborted()
        submissions.set(id, { phase: 'sending', text })
        dispatched = true
        await call('send', { sessionId: item.sessionId, text }, signal)
        submissions.delete(id)
        return { accepted: true, sessionId: item.sessionId }
      } catch (error) {
        if (dispatched && error.uncertain) {
          submissions.set(id, { phase: 'unknown', text })
          throw failure('mobile/send-unknown', 'Delivery result is unknown. Inspect the conversation before retrying.', { cause: error })
        }
        submissions.delete(id)
        throw error
      }
    },
    submission: id => submissions.get(id) ? { ...submissions.get(id) } : undefined,
    // Explicit human resolution only, after inspecting canonical history. Never call on reconnect.
    acknowledgeUnknown(id) {
      if (submissions.get(id)?.phase !== 'unknown') throw failure('mobile/not-unknown', 'No uncertain submission to resolve')
      submissions.delete(id)
    },
  })
}
