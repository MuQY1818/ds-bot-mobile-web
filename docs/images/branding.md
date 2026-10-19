# README whale mark

`whale-mark.png` is the Web illustration in the coordinated DS Bot Mobile README artwork set. It is documentation artwork, separate from the running-product screenshots.

## Source and method

- Created on 2026-10-19 from the user's supplied blue-purple DS Bot whale and gold-star reference.
- Original whale character: [DS Bot by Fei2411 and contributors](https://github.com/Fei2411/DeepSeek-Bot/blob/e522ca474f38a7c7d4d1e8d1c08f1b542fa2667f/ds-bot/src/client/characters.js), Apache-2.0. Existing upstream attribution and license notices remain applicable.
- Generated with the imagegen skill's unmodified `image_gen.py edit` CLI through the user-selected Laoli image API. The provider model alias was `gpt-image-2.5-flare`; this records the gateway identifier rather than asserting an independently verified underlying model version.
- The original whale image supplied the character reference. App and Bridge also used the generated Web mark to keep the family style consistent.
- Requested at 1536 × 1024, high quality, PNG. A local response adapter converted the provider's image URL into the Base64 format expected by the CLI.
- Generated on flat green; the imagegen chroma-key helper removed the background. The artwork was then cropped, padded and resized for a transparent 960 × 400px horizontal README asset, and inspected at its 360px display size on light and dark backgrounds.
- No private conversation, access address, QR code, credential or real product UI is part of this artwork. The three projects are independent community companions.

## Final generation prompt

```text
Use case: logo-brand
Asset type: horizontal mascot illustration above a GitHub README project title.
Primary request: create a cute, polished Web companion mark for the DS Bot Mobile family.
Input image 1: character and palette reference only. Use this exact recognizable blue-purple little whale as the mascot: oval rounded body, lifted two-lobed tail to the left, two narrow white face marks near the right end, simple lighter periwinkle facets, and a small warm gold five-point star. Keep its abstract friendly face; do not add eyes, teeth or a mouth.
Subject: the whale playfully overlaps the lower left edge of a small minimal rounded browser-window frame; the browser has three tiny window-control dots and an otherwise empty interior. One gold star floats near the whale's nose. The whale is the main character; the window is a restrained supporting prop.
Style/medium: premium cute flat illustration, vector-like clean smooth shapes, friendly rounded geometry, restrained tonal facets, crisp edges. No black outlines, no 3D rendering, no textures, no shadows, no glow.
Composition/framing: a compact balanced horizontal silhouette, width about 2.5 times its height, centered with very generous plain space above and below. Keep every part fully inside the canvas. Aim for a readable little mascot mark, not a large scene or a webpage mockup.
Color palette: vivid periwinkle and cornflower blue whale; lavender-blue window outline; warm golden yellow star; white facial slits. No green in the subject.
Scene/backdrop: completely flat solid bright chroma green #00FF00 across the whole canvas, including all empty areas inside the browser frame. This green will be removed later; it must not reflect or bleed onto the subject. No gradient, floor, vignette or drop shadow.
Text: none. No letters, words, project name, captions, QR codes, URLs or watermark.
Constraints: preserve the reference whale identity and gold star. Only one whale, one browser frame and one star. Do not reproduce the reference gray background. Every visible element belongs to a single centered horizontal group.
```
