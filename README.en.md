<h1 align="center">DS Bot Mobile Web</h1>

<p align="center">Continue working with your Bot team from your phone's browser.</p>

<p align="center">
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml"><img src="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml/badge.svg?branch=main" alt="Build and checks"></a>
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.4.2"><img src="https://img.shields.io/badge/release-0.4.2-blue" alt="Version 0.4.2"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · English · <a href="docs/installation.md">Installation</a> · <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases">Downloads</a> · <a href="https://github.com/MuQY1818/ds-bot-mobile-web/issues">Issues</a>
</p>

DS Bot Mobile Web is a mobile interface plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) and [DS Bot](https://github.com/Fei2411/DeepSeek-Bot). It adds phone navigation, a team view and QR sign-in to your existing installation, sharing the Bots, group chats and message history on your computer.

> **Current version `0.4.2`**: targets DSH `0.2.1-rc.2` with DS Bot `0.1.7` and dismisses the mobile composer keyboard when a valid send begins. Host installation and device validation are recorded separately. Install the plugin on the computer and access it through a phone browser. See [development status](docs/status.md) for the limits of Safari device and network validation. For a native client, see [DS Bot Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app).

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

- **Mobile navigation**: conversations, team, search, connection status and back navigation.
- **Existing chat features**: reuses the DS Bot renderer and composer, including streaming replies, groups and interactive cards.
- **Unified phone access**: opens **Phone access → Web** from the account menu. Compatible App and Web plugins share a tabbed dialog and remain independently managed.
- **Bot identity**: preserves character avatars, work status and group member combinations.
- **Consistent chat design**: compact lists, centered identity, black user bubbles and quiet Bot bubbles. Wide screens retain the desktop layout.
- **Faster return navigation**: retains the host's canonical in-memory sessions for the 3 most recent conversations for up to 5 minutes; no separate transcript storage.
- **Less duplicate synchronization**: shares in-flight team reads, cancels superseded navigation, and pauses mobile metadata polling on desktop or hidden pages. Live messages still use the host Session stream. See the [isolated network measurements](docs/network-performance.md).

## Development status

The Web plugin is usable. The recent package-rename configuration regression has been repaired; full Safari device acceptance remains pending. See [Development status](docs/status.md).

## Quick start

### Requirements

| Component | Requirement |
| --- | --- |
| Computer | A working DSH and DS Bot installation with an existing team |
| Validated combination | DSH `0.2.1-rc.2` / DS Bot `0.1.7` |
| Network | A phone-accessible HTTPS endpoint and host trust configuration |
| Phone | A browser; access to the relevant private network when applicable |

### Install and sign in

1. On the computer, download `ds-bot-mobile-web-0.4.2.tgz` and `SHA256SUMS` from the [v0.4.2 release](https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.4.2). Verify the archive using the [installation guide](docs/installation.md#2-下载发布包并核对-sha-256).
2. Install the local `.tgz` through your existing DSH plugin manager. Confirm the package and version, enable it and refresh. Restart if the host requests it.
3. In the desktop DS Bot account menu, select **Phone access → Web**. If needed, enter an HTTPS address you have already configured.
4. Connect the phone to the appropriate network, scan the QR code and sign in through the browser.

Read [remote access](docs/remote-access.md) if you do not yet have a network endpoint. The plugin reuses DSH authentication; configure HTTPS, proxies and domain trust in the host environment.

**Upgrading from the old package**: disable `dsh-mobile-layout-local` before enabling `ds-bot-mobile-web`. Existing layout preferences and endpoint configuration are retained. See [migration](docs/installation.md#从旧包名迁移).

## Web and native App

| | Mobile Web | Mobile App |
| --- | --- | --- |
| Client | Phone browser | Native iOS / Android client |
| Computer component | This Web plugin | Mobile App pairing plugin + Mobile Bridge |
| Authentication | DSH browser sign-in URL | Owner-approved device pairing |
| Use case | Access to the existing DS Bot Web interface | Native navigation, device authorization and local caching |

The projects are maintained separately and connect to the existing team. Mobile Web does not require Mobile Bridge.

There are three independently managed desktop plugins: `ds-bot-mobile-web` supplies the browser interface and sign-in, `ds-bot-mobile-app` supplies native App pairing and device-management UI, and `ds-bot-mobile-bridge` supplies device authentication and transport. The latter two live in the [App repository](https://github.com/MuQY1818/ds-bot-mobile-app/blob/main/docs/plugins.md). Disabling the pairing UI leaves Bridge and existing device access running.

## Development

Use Git, Node.js 24+, npm and Python 3 for the source audit. Clone with the pinned upstream submodule:

```sh
git clone --recurse-submodules https://github.com/MuQY1818/ds-bot-mobile-web.git
cd ds-bot-mobile-web
npm run setup
npm run check
npm run build
npm run audit:files
```

After committing the source, run `npm run pack` to create the archive, checksums and source metadata in `artifacts/`. Packaging requires a clean working tree. Published tags and release assets remain paired. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Documentation

The detailed guides are currently in Simplified Chinese.

| Guide | Contents |
| --- | --- |
| [Installation](docs/installation.md) | Verification, installation, upgrades and rollback |
| [Remote access](docs/remote-access.md) | Private networking, HTTPS, domain trust and sign-in |
| [Network options](docs/remote-connectivity.md) | ZCode relay, Tailscale and Cloudflare Tunnel |
| [Usage](docs/usage.md) | Navigation, QR panel and connection status |
| [Troubleshooting](docs/troubleshooting.md) | Connection, authentication and layout problems |
| [Architecture](docs/architecture.md) | Host APIs, credential boundaries and menu adaptation |
| [Compatibility and validation](docs/validation.md) | Verified scenarios and platform limitations |
| [Changelog](CHANGELOG.md) | Release changes |

## Compatibility and credentials

The layout uses public plugin APIs and some host DOM markers. The account-menu entry uses a separate DOM adapter. Recheck compatibility after upgrading DSH or DS Bot; if the menu entry fails, open the panel from the `ds-bot-mobile-web` bundle details in the plugin manager.

The complete iPhone Safari keyboard, safe-area, lock-screen and network-transition matrix still requires device validation. See the [validation record](docs/validation.md).

QR sign-in codes and complete URLs carry access credentials. Share them only with your own devices. Closing the panel clears its UI state; refreshing the entry does not revoke existing links. Obtain a new sign-in URL after a host restart.

## Contributing

Documentation improvements and reproducible bug reports are welcome. Read the [contribution guide](CONTRIBUTING.md). Include DSH, DS Bot and plugin versions, plus reproduction steps; remove sign-in URLs, QR codes and private conversation content.

## License and acknowledgments

Licensed under [Apache License 2.0](LICENSE). Character components come from a pinned [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) revision. QR encoder and dependency notices are in [NOTICE](NOTICE) and the [plugin NOTICE](mobile-web-prototype/plugin/NOTICE).

Independent community project; not affiliated with DeepSeek.
