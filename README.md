<div align="center">

<p><img src="docs/images/whale-mark.png" width="360" alt="DS Bot Mobile Web 小鲸鱼与浏览器窗口标识"></p>

<h1>DS Bot Mobile Web</h1>

<p>用手机浏览器接续电脑上的 Bot、群聊和消息历史。</p>

<p>
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml?query=branch%3Amain"><img src="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases/latest"><img src="https://img.shields.io/github/v/release/MuQY1818/ds-bot-mobile-web?color=2563eb" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/MuQY1818/ds-bot-mobile-web" alt="License"></a>
</p>

<p>简体中文 · <a href="README.en.md">English</a> · <a href="#快速开始">快速开始</a> · <a href="docs/README.md">文档</a> · <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases">下载</a> · <a href="CONTRIBUTING.md">参与贡献</a></p>

</div>

DS Bot Mobile Web 为已有的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）和 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) 增加手机会话导航、响应式聊天界面和扫码登录入口。插件运行在电脑上，手机通过浏览器使用原有团队；消息渲染、输入和流式连接继续由宿主处理。

**面向手机浏览器与手机主屏幕入口使用。** 无需构建原生 App，也不依赖 Mobile Bridge 或 App 配套插件。电脑、DSH 和网络入口需要保持可用。

## 界面预览

<p align="center">
  <img src="docs/images/conversations.png" width="230" alt="Mobile Web 会话列表，展示示例 Bot、精灵与搜索入口">
  <img src="docs/images/chat.png" width="230" alt="Mobile Web 单聊，使用示例消息与 mock 模型">
  <img src="docs/images/group.png" width="230" alt="Mobile Web 群聊，展示成员署名与示例消息">
</p>

<p align="center"><em>会话列表 · 单聊 · 群聊</em></p>

这些图片来自隔离 DSH / DS Bot 宿主中实际运行的 Web 组件，使用示例数据和 mock 模型，保留原始渲染。它们是 390px 响应式浏览器截图，不能代替 iPhone Safari 真机验收。所示布局的版本范围及后续主题变化见[图片来源](docs/images/README.md)和[设计说明](docs/design.md)。

<details>
  <summary><strong>电脑端：Web 扫码登录入口</strong></summary>

<p align="center">
  <img src="docs/images/phone-access-window.png" width="960" alt="真实电脑窗口中的手机访问 Web 标签，展示浏览器扫码登录入口">
</p>

用户提供的真实 **Web** 标签截图。为便于公开展示，二维码已替换为不含登录凭据的 `https://phone.example/demo`，地址改为示意域名，背景聊天已加重模糊；其余登录界面保留。共享弹窗不表示 Web 依赖 App 插件。

</details>

## 为手机使用而做

| 能力 | 实际行为 |
| --- | --- |
| **会话与团队导航** | 搜索并打开已有 Bot 和群聊，显示精灵、群头像与工作状态。 |
| **沿用宿主聊天能力** | 复用 DS Bot 的消息和输入组件，保留流式回复、群成员归属、工具结果与宿主支持的交互卡片。 |
| **电脑扫码登录** | 在电脑打开 **手机访问 → Web**，由 DSH 为已配置的 HTTPS 地址生成浏览器登录链接。 |
| **手机输入与滚动** | 有效发送开始后收起键盘；Shift+Enter 换行。外层页面锁定，聊天、设置与多行输入各自滚动。 |
| **有界缓存与启动反馈** | 短期保留最近会话引用，缓存符合条件的静态代码；提供独立加载层和 iPhone 桌面启动图。 |
| **持久日夜外观** | 主页太阳／月亮按钮复用宿主偏好，支持主题过渡、减少动态效果，以及独立于原 Bot 样式的精灵配色。 |

`0.4.17` 在团队接口拒绝请求时核验原有浏览器登录，区分登录过期与连接恢复故障，减少不必要的重新扫码。保留近期会话缓存、自动重连和 iOS 27 主屏幕适配。

**当前发布：0.4.17。** 当前适配组合为 DSH `0.2.1-rc.2` / DS Bot `0.1.7`。宿主交互能力取决于该组合；不同浏览器的键盘、后台恢复与网络切换仍有差异。详见[版本状态](docs/status.md)、[0.4.17 说明](docs/releases/v0.4.17.md)和[验证记录](docs/validation.md)。

## 快速开始

### 1. 在电脑安装 Web 插件

前提是电脑上的 DSH 和 DS Bot 已正常运行，原团队可以使用。

从 [Releases](https://github.com/MuQY1818/ds-bot-mobile-web/releases/latest) 下载插件 **`ds-bot-mobile-web-0.4.17.tgz`**。在现有 DSH 插件管理器中安装、启用，再刷新页面；宿主提示重启时按提示处理。

GitHub 自动生成的 “Source code” 压缩包用于开发，手机不需要下载或解压插件包。

### 2. 准备手机能访问的 HTTPS 入口

复用现有 HTTPS 入口，保持电脑唤醒。使用 Tailscale 等私网时，两端都要连接对应网络。电脑的 `localhost` / `127.0.0.1` 不能直接给手机使用。

尚无入口时，先阅读[网络与登录配置](docs/remote-access.md)。插件负责移动界面和登录入口，不创建隧道，也不修改宿主信任配置。

### 3. 扫码，打开原有会话

在电脑 DS Bot 账户菜单选择 **手机访问 → Web**。确认入口就绪后，用手机扫码或私密传递登录链接，在目标浏览器完成登录。菜单不可见时，可从官方插件配置页打开同一弹窗。

打开一个已有 Bot 或群聊，即可继续使用原来的团队。之后收藏普通入口，或按[使用指南](docs/usage.md#添加到手机桌面)添加到 iPhone / Android 桌面。

> Web 登录二维码与 App 配对二维码用途不同，不能互换。登录二维码和完整登录链接携带访问权限，只给自己的设备。

安装细节、升级、回退与旧包名迁移见[安装指南](docs/installation.md)。连接超时、认证失败和历史加载问题见[故障排查](docs/troubleshooting.md)。

`0.4.7` 另优化长会话发生更新时的样式匹配，减少移动布局的重算开销。测量条件与范围见[性能记录](docs/network-performance.md#047长会话样式计算)。

## 缓存与连接如何工作

- **返回会话：** 当前页面最多保留最近 3 个会话的引用，保留窗口为 5 分钟；每次打开仍向宿主确认当前会话与权限。
- **再次启动：** 浏览器可复用符合条件的静态资源缓存，加载层提供等待反馈；页面、登录与聊天 API 不进入该静态缓存。
- **页面回收：** 刷新、长后台或系统回收网页后，需要恢复连接和历史。添加到桌面提供便捷入口，不等于离线聊天。
- **电脑离线：** 电脑休眠、退出 DSH 或私网断开后，需要先恢复宿主与网络。

性能结果按具体环境记录，不把某台设备的一次体验写成所有网络的启动承诺。缓存范围、测量方法和已知限制见[性能记录](docs/network-performance.md)与[常见问题](docs/faq.md)。

## 三个项目，各司其职

| 项目 | 职责 | 只用 Web 时需要吗？ |
| --- | --- | --- |
| **[Mobile Web](https://github.com/MuQY1818/ds-bot-mobile-web)** | 电脑端 Web 插件：手机浏览器界面、导航和 DSH 浏览器登录入口。 | **需要** |
| **[Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app)** | 原生客户端源码与电脑端 App 配套插件：配对、批准和设备管理界面。 | 不需要 |
| **[Mobile Bridge](https://github.com/MuQY1818/ds-bot-mobile-bridge)** | 电脑端设备认证、HTTP / WebSocket 传输和撤销能力，供原生客户端使用。 | 不需要 |

Web 与 App 可以共享一个“手机访问”弹窗，同时保持独立安装和启停。原生客户端安装形式与验证状态以 [App 仓库](https://github.com/MuQY1818/ds-bot-mobile-app) 为准；当前没有公开即装 IPA / APK。实现边界见[架构说明](docs/architecture.md)。

## 文档地图

| 我想…… | 阅读 |
| --- | --- |
| 安装、更新、回退或迁移旧包 | [安装与连接](docs/installation.md) |
| 使用聊天、主题和桌面入口 | [使用指南](docs/usage.md) |
| 判断网络、认证或加载问题 | [故障排查](docs/troubleshooting.md) · [常见问题](docs/faq.md) |
| 配置 HTTPS / Tailscale | [网络与登录](docs/remote-access.md) |
| 了解当前支持范围 | [状态](docs/status.md) · [验证](docs/validation.md) · [性能](docs/network-performance.md) |
| 阅读源码、测试或打包 | [开发指南](docs/development.md) · [架构](docs/architecture.md) |
| 查看截图来源与更新历史 | [设计](docs/design.md) · [图片来源](docs/images/README.md) · [CHANGELOG](CHANGELOG.md) |

完整入口见[文档首页](docs/README.md)。详细指南目前以简体中文维护，英文概览见 [English README](README.en.md)。

## 参与贡献

欢迎提交缺陷、兼容性记录、文档和翻译改进。请在 [Issues](https://github.com/MuQY1818/ds-bot-mobile-web/issues) 附上组件版本、设备 / 浏览器与复现步骤；截图移除登录链接、二维码和私人会话。

开发使用 **Node.js 24、npm、Git 和 Python 3**。源码包含固定版本的 DS Bot submodule；克隆、检查和交付命令集中在[开发指南](docs/development.md)。运行态测试使用隔离 profile 和 mock 数据。提交前阅读[贡献指南](CONTRIBUTING.md)；文档修改应同步两种 README，并核对相对链接。

## 许可与致谢

[Apache License 2.0](LICENSE)。本项目基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件能力，并复用固定版本 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) 的聊天和精灵组件。二维码在本地通过 `qrcode` 生成，相关依赖声明随安装包分发。

完整来源、固定上游版本及版权说明见 [NOTICE](NOTICE) 和[插件 NOTICE](mobile-web-prototype/plugin/NOTICE)。感谢上游作者与提供真实设备反馈的使用者。本项目是独立社区项目，与 DeepSeek 官方无隶属关系。
