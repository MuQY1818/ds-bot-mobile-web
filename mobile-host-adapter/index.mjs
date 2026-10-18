import { readFile } from 'node:fs/promises'

export const name = 'mobile-host-adapter-local'
export const inject = ['connection']
export const DESCRIPTION = Object.freeze({
  version: 1,
  transport: 'existing-dsh-web',
  authentication: 'existing-browser-session',
  teamRoute: 'api/bot',
  clientModule: 'api/mobile-host/client.mjs',
  textSend: 'single-attempt-no-automatic-retry',
  durableDeduplication: false,
  groupHistory: 'dsh-session-projection',
  newBotRuntime: false,
})

export function apply(ctx) {
  if (typeof ctx.connection?.fetch?.register !== 'function') throw new Error('Public Connection Fetch registration is required')
  const headers = { 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff' }
  // Connection owns browser authentication, Host/Origin admission and Peer checks.
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/mobile-host/describe', methods: ['GET'], requestBody: 'buffered',
    fetch: () => Response.json(DESCRIPTION, { headers }),
  }))
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/mobile-host/conversation-feed.mjs', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => new Response(await readFile(new URL('./conversation-feed.mjs', import.meta.url), 'utf8'), {
      headers: { ...headers, 'content-type': 'text/javascript; charset=utf-8' },
    }),
  }))
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/mobile-host/client.mjs', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => new Response(await readFile(new URL('./client.mjs', import.meta.url), 'utf8'), {
      headers: { ...headers, 'content-type': 'text/javascript; charset=utf-8' },
    }),
  }))
}
