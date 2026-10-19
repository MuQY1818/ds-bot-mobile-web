# DS Bot Mobile Web

Continue your existing Bot conversations from a phone browser.

[简体中文](README.md) · [Installation](docs/installation.md) · [Usage](docs/usage.md) · [Downloads](https://github.com/MuQY1818/ds-bot-mobile-web/releases) · [Issues](https://github.com/MuQY1818/ds-bot-mobile-web/issues)

DS Bot Mobile Web adds phone navigation, a responsive chat layout and QR sign-in to an existing [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) installation. Install the plugin on the computer and use a browser on the phone. A native App and Mobile Bridge are not required.

The current version is **0.4.6**, targeting DSH **0.2.1-rc.2** and DS Bot **0.1.7**. A persistent sun/moon toggle adds a short theme transition, with readable controls and correctly colored mascots, badges and group avatars in both themes. Home-screen launch images, independent loading feedback, code caching and keyboard dismissal improvements are retained. Web is the primary access path; the native source preview is maintained in [DS Bot Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app).

## Preview

<p align="center">
  <img src="docs/images/conversations.png" width="230" alt="Running Mobile Web conversation list with example data">
  <img src="docs/images/chat.png" width="230" alt="Running Mobile Web direct chat with example data and a mock model">
  <img src="docs/images/group.png" width="230" alt="Running Mobile Web group chat with example data and mock models">
</p>

*Conversation list, direct chat and group chat captured from the actual plugin running in an isolated DSH / DS Bot host, with example data and mock models. The interface was not redrawn. These are 390px responsive browser captures, not iPhone Safari screenshots. See [design and screenshot provenance](docs/design.md).*

<details>
  <summary>Desktop phone access: deployed interface</summary>

<p align="center">
  <img src="docs/images/phone-access-window.png" width="960" alt="Full desktop window showing the shared phone-access entry with the App tab selected">
</p>

*The shared phone-access entry with the **App** tab selected. This full-window capture retains its blurred background and shows no pairing QR or access credentials. Browser sign-in is available from the Web tab in the same dialog.*

</details>

## Features

- Search and open existing Bots and groups, with character avatars and work status.
- Reuse the DS Bot renderer and composer, including streaming replies, group authorship, tool results and host-supported cards.
- Obtain browser sign-in from **Phone access → Web** in the desktop account menu.
- Dismiss the phone keyboard when a valid send starts. Shift+Enter still inserts a newline; wide desktop layouts retain composer focus.
- Retain recent conversations briefly within the current page and pause extra mobile metadata polling on desktop or in the background.
- Share the phone-access dialog with the optional App companion while keeping each plugin independently managed.

## Start in three steps

1. **Install on the computer.** Download the latest `.tgz` plugin package from [Releases](https://github.com/MuQY1818/ds-bot-mobile-web/releases), install and enable it in your existing DSH plugin manager, then refresh.
2. **Prepare a reachable endpoint.** Keep the computer and DSH running, and make the configured HTTPS address accessible to the phone. If using Tailscale, connect both devices to the relevant private network. See [network setup](docs/remote-access.md).
3. **Scan and sign in.** Open **Phone access → Web** on the computer, confirm the endpoint is ready, then scan the QR code and open a conversation in the phone browser.

The [installation guide](docs/installation.md) covers upgrades, old-package migration and rollback. Choose the plugin `.tgz` release asset for installation; GitHub source archives are for development.

## Everyday use

Bookmark the ordinary endpoint or [add it to the home screen](docs/usage.md#添加到手机桌面). The computer must remain awake with DSH running. If sign-in expires, obtain a new sign-in QR on the computer.

A home-screen shortcut is not an offline App. Cached static assets can be reused on later launches. A discarded page or a long background period still requires connection and history recovery. See the [FAQ](docs/faq.md) for current cache and sign-in behavior.

## Platforms and components

| Access path | Phone | Computer components |
| --- | --- | --- |
| **Mobile Web, primary path** | Modern browsers such as Safari on iPhone and Chrome on Android | DSH, DS Bot and `ds-bot-mobile-web` |
| Native source preview | A self-built iOS / Android client | Compatible DS Bot, App companion and Mobile Bridge |

Not every browser/device combination has completed acceptance testing. Safari backgrounding, network transitions and home-screen cold starts still need work. Public ready-to-install IPA/APK files are not available.

The three computer plugins have separate roles: Web supplies browser access; `ds-bot-mobile-app` supplies native pairing/device management; `ds-bot-mobile-bridge` supplies device authentication and transport. Web users need only the Web plugin.

## Documentation

The detailed guides are in Simplified Chinese.

| Guide | Topic |
| --- | --- |
| [Installation](docs/installation.md) | Installation, sign-in, updates, migration and rollback |
| [Usage](docs/usage.md) | Conversations, sending and home-screen shortcuts |
| [FAQ](docs/faq.md) | Caching, sleep and Web versus App |
| [Troubleshooting](docs/troubleshooting.md) | Connectivity, authentication, missing entry and slow loading |
| [Network setup](docs/remote-access.md) | HTTPS, private networking and host configuration |
| [Status](docs/status.md) | Released capabilities and current limitations |
| [Changelog](CHANGELOG.md) | User-visible changes |

Developers can use the [contribution guide](CONTRIBUTING.md), [architecture](docs/architecture.md) and [validation record](docs/validation.md). The source uses Node.js 24. Build and release checks are development tasks, not prerequisites for using the phone interface.

## Access and privacy

Sign-in QR codes and full sign-in links carry access credentials; share them only with your own devices. Include device, browser, version and reproduction steps in bug reports, and remove QR codes, sign-in URLs and private conversations. The plugin does not provision public endpoints or change network settings.

## License and provenance

[Apache License 2.0](LICENSE). Character components come from a pinned [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) revision. Copyright and dependency notices remain in [NOTICE](NOTICE) and the [plugin NOTICE](mobile-web-prototype/plugin/NOTICE). This independent community project is not affiliated with DeepSeek.
