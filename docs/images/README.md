# Documentation images

| Image | Source and scope | Privacy treatment |
| --- | --- | --- |
| `mobile-web-running.png` | Deployed Mobile Web in a 390px responsive browser viewport; captured on 2026-10-18. This is not an iPhone Safari screenshot. | Conversation previews are covered with solid masks. |
| `phone-access.png` | Running desktop **Phone access → Web** dialog from the same deployment. | Cropped to the dialog; the credential-bearing QR code and network address are covered with solid masks. No replacement QR is inserted. |
| `phone-access-window.png` | Full desktop window showing the real **Phone access → Web** sign-in dialog; supplied by the user for the Web README on 2026-10-19. Replaces the previous App-tab capture. | The original credential-bearing QR is fully replaced with `https://phone.example/demo`, without a token. The private host label is replaced with `https://phone.example/`. Background conversations receive stronger blur; the dialog layout and controls remain real. PNG ancillary metadata is removed. |
| `conversations.png`, `chat.png`, `group.png` | Actual Web components rendered against an isolated DSH host with example data and mock models. Used in the README and design notes. | Fictional names and conversation content; no user messages or live credentials. |

The captures retain the rendered interface. The table records the privacy edits for each image, including the explicitly documented example QR and host replacement in the full Web sign-in capture. PNG metadata was checked before inclusion. Private reference images and the unredacted originals are not distributed.

## README artwork

`whale-mark.png` is an AI-assisted illustration based on the user-supplied DS Bot whale reference. It is not a product screenshot. See [artwork source, generation method and prompt](branding.md).

## iOS 27 页头验证

`ios27-header-comparison.png` 来自 iPhone 15 Pro Max / iOS 27.0 模拟器中真实添加到主屏幕的隔离 DSH / DS Bot 页面。左侧为 0.4.14 复现，右侧为 0.4.15 候选第三次冷启动，裁切并等比缩小页头后加版本标签；没有重绘或替换页面内容。两侧使用 mock profile，不含用户聊天、设备地址、二维码或登录凭据。该图不代表用户 iPhone 真机验收。
