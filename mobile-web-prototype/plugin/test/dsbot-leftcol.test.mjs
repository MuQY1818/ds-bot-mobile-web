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

// Issue #4 follow-up: DS Bot 0.2 also writes `._centerCol{margin-left:<rail/open width>px!important}`,
// leaving an empty strip on the left once its column is hidden.
test('mobile styles cancel the DS Bot left-column margin on the centre column', async () => {
  const css = await readFile(new URL('../src/mobile.css', import.meta.url), 'utf8')
  const rule = 'body[data-dsm-enabled] [class*="_centerCol"]{margin-left:0!important}'
  assert.ok(css.includes(rule))
  assert.ok(compileMobileStyles(css, new Set()).includes(rule))
})

// DS Bot 0.2 `@media (hover:none)` adds right:4px + card shadow to .bt-tools; with our left:0 the
// toolbar stretched into a full-width white bar under the tapped message.
test('mobile message toolbar stays an inline icon row under DS Bot 0.2 touch styles', async () => {
  const css = await readFile(new URL('../src/mobile.css', import.meta.url), 'utf8')
  const rule = css.match(/body\[data-dsm-enabled\] \.bt-tools\{([^}]*)\}/)?.[1] ?? ''
  for (const decl of ['left:0', 'right:auto', 'padding:0', 'box-shadow:none']) assert.ok(rule.split(';').includes(decl), decl)
})
