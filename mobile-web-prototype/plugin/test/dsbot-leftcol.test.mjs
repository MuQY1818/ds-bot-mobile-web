import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {compileMobileStyles} from '../src/mobile-styles.mjs'

// Issue #4: DS Bot 0.2+ portals .bt-leftcol (fixed, left:0) and .bt-title-toggle to <body>,
// so hiding the host sidebar column alone leaves them over the mobile page.
test('mobile styles hide DS Bot body-level left column and title toggle', async () => {
  const css = await readFile(new URL('../src/mobile.css', import.meta.url), 'utf8')
  const rule = 'body[data-dsm-enabled]>:is(.bt-leftcol,.bt-title-toggle){display:none!important}'
  assert.ok(css.includes(rule))
  assert.ok(compileMobileStyles(css, new Set()).includes(rule))
})
