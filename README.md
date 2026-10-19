# DS Bot Mobile Web

在手机浏览器中继续使用电脑上的 Bot、群聊和消息历史。

[English](README.en.md) · [安装与连接](docs/installation.md) · [使用指南](docs/usage.md) · [下载](https://github.com/MuQY1818/ds-bot-mobile-web/releases) · [反馈](https://github.com/MuQY1818/ds-bot-mobile-web/issues)

DS Bot Mobile Web 为已有的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）和 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) 增加手机布局、会话导航和扫码登录入口。插件安装在电脑上，手机直接用浏览器访问；无需安装原生 App，也无需 Mobile Bridge。

当前已发布版本 **0.4.5**，适配 DSH **0.2.1-rc.2** 与 DS Bot **0.1.7**。本版增加 iPhone 桌面启动画面和独立加载层，保留大型代码缓存、发送后的键盘过渡与并行恢复。项目以 Web 为主要使用入口；原生客户端另见 [DS Bot Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app)。

本分支的 **0.4.6 候选**增加日夜切换：主页左上角太阳／月亮按钮沿用宿主外观偏好，刷新后保持选择。发布状态以 [Releases](https://github.com/MuQY1818/ds-bot-mobile-web/releases) 为准。

## 界面预览

<p align="center">
  <img src="docs/images/conversations.png" width="230" alt="实际 Mobile Web 会话列表，使用示例数据">
  <img src="docs/images/chat.png" width="230" alt="实际 Mobile Web 单聊，使用示例数据和 mock 模型">
  <img src="docs/images/group.png" width="230" alt="实际 Mobile Web 群聊，使用示例数据和 mock 模型">
</p>

*会话列表、单聊与群聊均来自隔离 DSH / DS Bot 宿主中实际运行的插件，使用示例数据与 mock 模型，未重绘界面。图片为 390px 响应式浏览器实测，不是 iPhone Safari 真机截图。界面和截图来源见[设计说明](docs/design.md)。*

<details>
  <summary>电脑端手机访问：实际部署截图</summary>

<p align="center">
  <img src="docs/images/phone-access-window.png" width="960" alt="完整电脑窗口中的共享手机访问入口，图中为 App 标签">
</p>

*共享手机访问入口，图中为 App 标签。完整窗口图保留原有模糊背景，未展示配对二维码或访问凭据；Web 登录入口位于同一弹窗的 Web 标签。*

</details>

## 能做什么

- 在会话列表与团队视图中搜索、打开已有 Bot 和群聊，查看精灵头像与工作状态。
- 沿用 DS Bot 的聊天与输入组件，保留流式回复、群成员归属、工具结果和宿主支持的交互卡片。
- 在电脑账户菜单的 **手机访问 → Web** 中取得登录二维码或链接。
- 发送有效消息后收起手机输入键盘；Shift+Enter 继续换行，桌面宽屏保留输入焦点。
- 在当前页面内短期保留最近会话，减少来回切换时的历史加载；后台和桌面停止额外的手机元数据轮询。
- 与 App 配套插件共用一个手机访问弹窗，两种方式仍可独立安装和启停。

## 三步开始

1. **安装到电脑**：从 [Releases](https://github.com/MuQY1818/ds-bot-mobile-web/releases) 下载最新 Release 的 `.tgz` 插件包，在现有 DSH 插件管理器安装并启用，刷新页面。
2. **准备手机入口**：保持电脑和 DSH 运行，确认手机能访问已配置的 HTTPS 地址。使用 Tailscale 时，两端都要连接对应私网。配置方法见[网络连接](docs/remote-access.md)。
3. **扫码登录**：在电脑选择 **手机访问 → Web**，确认入口就绪后扫码，在手机浏览器中打开会话。

详细步骤、旧包迁移和回退见[安装指南](docs/installation.md)。GitHub 自动生成的源码压缩包用于开发，安装插件请选择 Release 中的 `.tgz`。

## 日常使用

登录后可以收藏普通入口地址，或[添加到手机桌面](docs/usage.md#添加到手机桌面)。电脑休眠或退出 DSH 后，手机无法继续连接。登录失效时，从电脑重新取得登录二维码即可。

添加桌面只提供便捷入口，不代表离线应用。浏览器可复用已缓存的基础资源，但回收页面、长时间后台或清理站点数据后，仍需恢复连接与历史。[常见问题](docs/faq.md)说明缓存、登录与加载速度的实际边界。

## 平台与组件

| 使用方式 | 手机端 | 电脑端需要 |
| --- | --- | --- |
| **Mobile Web，主要入口** | iPhone Safari、Android Chrome 等现代浏览器 | DSH、DS Bot、`ds-bot-mobile-web` |
| 原生 App，源码预览 | 自行构建的 iOS / Android 客户端 | 兼容 DS Bot、App 配套插件、Mobile Bridge |

浏览器适配不代表所有系统组合均完成设备验证。iPhone Safari 的长后台、网络切换和桌面入口冷启动仍需持续完善。原生 App 当前没有公开可直接安装的 IPA/APK。

三个电脑端插件各司其职：Web 提供浏览器界面；`ds-bot-mobile-app` 提供原生 App 配对管理；`ds-bot-mobile-bridge` 提供设备认证和传输。只用 Web 时，后两个不用安装。

## 文档

| 文档 | 解决的问题 |
| --- | --- |
| [安装与连接](docs/installation.md) | 安装、扫码、升级、旧包迁移与回退 |
| [使用指南](docs/usage.md) | 会话、发送、添加桌面与日常登录 |
| [常见问题](docs/faq.md) | 缓存、电脑休眠、Web 与 App 的区别 |
| [故障排查](docs/troubleshooting.md) | 无法打开、认证失败、入口缺失与加载缓慢 |
| [网络连接](docs/remote-access.md) | HTTPS、私网及宿主入口配置 |
| [当前状态](docs/status.md) | 已发布功能和正在完善的部分 |
| [版本记录](CHANGELOG.md) | 各版本用户可见变化 |

开发者可阅读[贡献指南](CONTRIBUTING.md)、[架构](docs/architecture.md)和[验证记录](docs/validation.md)。源码使用 Node.js 24；构建和发布检查属于开发流程，不是手机使用前的操作步骤。

## 访问与隐私

登录二维码及完整登录链接携带访问权限，只给自己的设备。反馈问题时请说明设备、浏览器、版本与复现步骤，遮住二维码、登录链接和私人聊天。插件不会创建公网入口或替你修改网络配置。

## 许可与来源

[Apache License 2.0](LICENSE)。精灵组件来自固定版本的 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot)，依赖和版权声明保留于 [NOTICE](NOTICE) 及[插件 NOTICE](mobile-web-prototype/plugin/NOTICE)。这是独立社区项目，与 DeepSeek 官方无隶属关系。
