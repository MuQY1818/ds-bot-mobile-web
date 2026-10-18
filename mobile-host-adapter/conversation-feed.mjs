const failure = (code, message) => Object.assign(new Error(message), { code })

// Run inside the existing DSH Client composition. No raw WebSocket or prompt calls.
export async function openConversationFeed({ ctx, api, conversationId, onUpdate, signal }) {
  if (typeof ctx?.sessions?.retain !== 'function' || typeof ctx?.uiConversation?.binding !== 'function') {
    throw failure('mobile/client-services-required', 'The DSH Session and Conversation client services are required')
  }
  signal?.throwIfAborted()
  const target = await api.target(conversationId, signal)
  signal?.throwIfAborted()
  const reference = ctx.sessions.retain(target.sessionId, { source: 'mobileHostView', signal })
  let closed = false
  const unsubscribers = []
  const nodeSubscriptions = new Map()
  let chat
  let session
  const close = () => {
    if (closed) return
    closed = true
    signal?.removeEventListener('abort', close)
    for (const off of unsubscribers.splice(0)) off()
    for (const off of nodeSubscriptions.values()) off()
    nodeSubscriptions.clear()
    reference.release()
  }
  signal?.addEventListener('abort', close, { once: true })
  const assertOpen = () => {
    signal?.throwIfAborted()
    if (closed) throw failure('mobile/feed-closed', 'Conversation subscription is closed')
  }
  const snapshot = () => {
    assertOpen()
    const value = chat.getSnapshot()
    return { conversationId, sessionId: target.sessionId, kind: target.kind,
      session: session.getSnapshot(), chat: value,
      nodes: (value?.order ?? []).map(key => value.nodes.get(key)).filter(node => node && node.visibility !== 'hidden'),
    }
  }
  const publish = () => { if (!closed) onUpdate(snapshot()) }
  const reconcile = () => {
    if (closed) return
    const value = chat.getSnapshot()
    const keys = new Set(value?.order ?? [])
    for (const [key, off] of nodeSubscriptions) {
      if (keys.has(key)) continue
      off()
      nodeSubscriptions.delete(key)
    }
    // Keyed source notifications carry assistant deltas even when order is unchanged.
    for (const key of keys) {
      if (!nodeSubscriptions.has(key)) nodeSubscriptions.set(key, value.nodes.source(key).subscribe(publish))
    }
    publish()
  }
  try {
    await reference.ready
    assertOpen()
    session = reference.binding.session
    chat = ctx.uiConversation.binding(reference.binding).target('chat')
    unsubscribers.push(chat.subscribe(reconcile))
    unsubscribers.push(session.subscribe(publish))
    reconcile()
  } catch (error) {
    close()
    throw error
  }
  return Object.freeze({
    snapshot,
    async loadOlder() {
      assertOpen()
      await session.loadOlder()
      assertOpen()
      return snapshot()
    },
    // Call on foreground/online. DSH already repairs the retained stream on reconnect.
    // A logical Bot rollover requires the UI to close this feed and open the new target.
    async refresh() {
      assertOpen()
      await ctx.sessions.refresh()
      const current = await api.target(conversationId, signal)
      assertOpen()
      if (current.sessionId !== target.sessionId) throw failure('mobile/session-changed', 'Reopen the current conversation part')
      reconcile()
      return snapshot()
    },
    close,
  })
}
