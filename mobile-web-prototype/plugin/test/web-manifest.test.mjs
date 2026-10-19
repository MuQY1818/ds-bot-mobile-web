import test from 'node:test'
import assert from 'node:assert/strict'
import {MOBILE_MANIFEST_PATH,ICON_DIRECTORY,ICONS,renderMobileManifest,mobileManifest} from '../web-manifest.mjs'

const page=(head)=>`<html><head>${head}</head><body><div id="root"></div></body></html>`

test('a host SVG-only icon is replaced by the served PNG icon',()=>{
  const rendered=renderMobileManifest(page('<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./favicon.svg">'))
  // iOS ignores SVG whatever the rel says, so a surviving SVG link would win.
  assert.ok(!/apple-touch-icon[^>]*favicon\.svg/.test(rendered))
  assert.match(rendered,/<link rel="apple-touch-icon" sizes="180x180" href="\/ds-bot-mobile-web-icon\/apple-touch-icon\.png">/)
  assert.ok(rendered.includes(`href="${MOBILE_MANIFEST_PATH}"`))
})

test('an absent icon link is added ahead of the manifest',()=>{
  const rendered=renderMobileManifest(page('<link rel="manifest" href="./manifest.webmanifest">'))
  assert.ok(rendered.indexOf('apple-touch-icon')<rendered.indexOf('rel="manifest"'))
  // Count link elements, not raw substrings: the href repeats the icon name.
  assert.equal(rendered.match(/<link rel="apple-touch-icon"/g).length,1)
})

test('rendering twice does not duplicate icons',()=>{
  const once=renderMobileManifest(page('<link rel="manifest" href="./manifest.webmanifest">'))
  assert.equal(renderMobileManifest(once),once)
})

test('every declared icon is served under the plugin icon path',()=>{
  const manifest=mobileManifest()
  assert.equal(manifest.display,'standalone')
  assert.deepEqual(manifest.icons.map(icon=>icon.src),ICONS.map(icon=>`${ICON_DIRECTORY}${icon.file}`))
  // iOS needs an opaque PNG: a transparent or SVG icon renders as a blank tile.
  assert.ok(manifest.icons.every(icon=>icon.type==='image/png'))
  assert.ok(manifest.icons.some(icon=>icon.sizes==='180x180'))
})

test('an apple touch icon is always the 180px PNG iOS expects',()=>{
  const rendered=renderMobileManifest(page('<link rel="manifest" href="./manifest.webmanifest">'))
  assert.match(rendered,/<link rel="apple-touch-icon" sizes="180x180" href="[^"]+apple-touch-icon\.png">/)
})
