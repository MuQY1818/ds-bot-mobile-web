<h1 align="center">DS Bot Mobile Web</h1>

<p align="center">在手机浏览器中，与自己的 Bot 团队继续工作。</p>

<p align="center">
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml"><img src="https://github.com/MuQY1818/ds-bot-mobile-web/actions/workflows/check.yml/badge.svg?branch=main" alt="构建与检查"></a>
  <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.4.2"><img src="https://img.shields.io/badge/release-0.4.2-blue" alt="版本 0.4.2"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0 许可"></a>
</p>

<p align="center">
  简体中文 · <a href="README.en.md">English</a> · <a href="docs/installation.md">安装指南</a> · <a href="https://github.com/MuQY1818/ds-bot-mobile-web/releases">下载</a> · <a href="https://github.com/MuQY1818/ds-bot-mobile-web/issues">反馈</a>
</p>

DS Bot Mobile Web 是面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）和 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot) 的移动界面插件。它在现有会话上提供适合手机的导航、团队视图和扫码登录入口，共用电脑上的 Bot、群聊与消息历史。

> **当前版本 `0.4.2`**：面向 DSH `0.2.1-rc.2` 与 DS Bot `0.1.7`，新增手机有效发送后收起键盘；宿主安装与设备验证分别记录。插件安装在电脑上，手机使用浏览器访问；Safari 真机网络场景的验证边界见[开发状态](docs/status.md)。原生客户端见 [DS Bot Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app)。

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

## 主要功能

- **移动会话导航**：会话列表、团队、搜索、连接状态与返回导航。
- **复用完整聊天界面**：沿用 DS Bot 的消息渲染和输入框，保留流式回复、群聊与交互卡片。
- **统一手机访问**：从账户菜单打开“手机访问 → Web”；与 App 配套插件共用 Web / App 标签弹窗，各包仍可独立启停。
- **保留 Bot 身份**：显示精灵头像、工作状态及群成员组合。
- **统一消息界面**：紧凑列表、居中身份、黑色用户气泡与浅灰 Bot 气泡，宽屏保留桌面布局。
- **快速返回会话**：保留最近 3 段会话的宿主内存引用，5 分钟内返回复用历史；不另存聊天转录。
- **减少重复同步**：合并并发团队查询，取消过期导航，桌面和后台停止手机元数据轮询；实时消息仍使用宿主 Session 流。隔离测量见[网络性能记录](docs/network-performance.md)。

## 开发状态

Web 插件已可使用；近期包名迁移导致的入口配置失效已修复。完整 Safari 真机验收仍待完成。详细进度见[开发状态](docs/status.md)。

## 快速开始

### 环境要求

| 组件 | 要求 |
| --- | --- |
| 电脑端 | 已运行 DSH 与 DS Bot，现有团队可正常使用 |
| 验证组合 | DSH `0.2.1-rc.2` / DS Bot `0.1.7` |
| 网络 | 手机可访问的 HTTPS 入口及宿主域名信任配置 |
| 手机端 | 浏览器；使用私网入口时需连接对应私网 |

### 安装与登录

1. 在电脑上从 [v0.4.2 发布页](https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.4.2) 下载 `ds-bot-mobile-web-0.4.2.tgz` 和同次发布的 `SHA256SUMS`，按[安装指南](docs/installation.md#2-下载发布包并核对-sha-256)核对校验值。
2. 在现有 DSH 的插件管理器中安装本地 `.tgz`，确认包名和版本，启用后刷新页面；如宿主要求重启，按提示操作。
3. 在电脑端 DS Bot 账户菜单选择 **手机访问 → Web**。入口未配置时，填写已准备好的 HTTPS 地址。
4. 手机接入对应网络，扫描二维码，并在浏览器中完成登录。

尚未准备网络入口时，请先阅读[远程访问](docs/remote-access.md)。插件复用 DSH 认证；HTTPS、代理及域名信任由宿主环境配置。

**从旧包升级**：先停用 `dsh-mobile-layout-local`，再启用 `ds-bot-mobile-web`。现有布局偏好与入口配置继续保留。详见[迁移说明](docs/installation.md#从旧包名迁移)。

## Web 与原生 App

| | Mobile Web | Mobile App |
| --- | --- | --- |
| 使用方式 | 手机浏览器 | iOS / Android 原生客户端 |
| 电脑端组件 | 本仓库的 Web 插件 | Mobile App 配对插件 + Mobile Bridge |
| 登录方式 | DSH 浏览器认证链接 | 电脑批准设备配对 |
| 适用场景 | 快速访问现有 DS Bot Web 界面 | 原生导航、设备授权与本地缓存 |

两者分别维护，均连接已有团队。使用 Mobile Web 无需安装 Mobile Bridge。

电脑端共有三个可独立启停的插件：`ds-bot-mobile-web` 提供手机 Web 与浏览器登录，`ds-bot-mobile-app` 提供原生 App 的配对和设备管理界面，`ds-bot-mobile-bridge` 提供设备认证与协议服务。后两者由 [App 仓库](https://github.com/MuQY1818/ds-bot-mobile-app/blob/main/docs/plugins.md)维护；停用配对界面不会停止 Bridge 或撤销现有设备。

## 开发

需要 Git、Node.js 24+、npm 和 Python 3（源码审计）。克隆时一并获取固定版本的上游子模块：

```sh
git clone --recurse-submodules https://github.com/MuQY1818/ds-bot-mobile-web.git
cd ds-bot-mobile-web
npm run setup
npm run check
npm run build
npm run audit:files
```

源码提交后，运行 `npm run pack` 生成 `artifacts/` 下的安装包、校验值及源码元数据。打包要求工作树干净；发布版本的标签与附件保持对应。开发流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [安装指南](docs/installation.md) | 下载校验、安装、升级与回退 |
| [远程访问](docs/remote-access.md) | 私网、HTTPS、域名信任与登录 |
| [网络方案](docs/remote-connectivity.md) | ZCode 中继、Tailscale 与 Cloudflare Tunnel 的选择 |
| [使用说明](docs/usage.md) | 手机导航、扫码面板与连接状态 |
| [故障排查](docs/troubleshooting.md) | 连接、认证与布局问题 |
| [架构](docs/architecture.md) | 宿主接口、凭据边界与菜单适配 |
| [兼容与验证](docs/validation.md) | 已验证场景及平台限制 |
| [变更记录](CHANGELOG.md) | 版本差异 |

## 兼容性与访问凭据

布局使用宿主公开插件接口，也依赖部分 DOM 标记；账户菜单入口通过独立 DOM 适配提供。升级 DSH 或 DS Bot 后需回归检查。菜单不可用时，可从 插件管理器 → ds-bot-mobile-web 详情页打开访问面板。

完整的 iPhone Safari 软键盘、安全区、锁屏及网络切换矩阵仍需真机验证，详见[验证说明](docs/validation.md)。

登录二维码和完整链接包含访问权限，应仅传给自己的设备。关闭面板会清理界面状态；刷新入口不等于撤销已有链接。宿主重启后请重新获取登录链接。

## 贡献与反馈

欢迎提交文档改进和可复现的缺陷报告。请先阅读[贡献指南](CONTRIBUTING.md)；报告问题时附上 DSH、DS Bot、插件版本和复现步骤，并移除登录链接、二维码和私人会话内容。

## 许可与致谢

采用 [Apache License 2.0](LICENSE)。精灵组件来自固定版本的 [DS Bot](https://github.com/Fei2411/DeepSeek-Bot)；二维码编码器及相关依赖的许可见 [NOTICE](NOTICE) 和[插件 NOTICE](mobile-web-prototype/plugin/NOTICE)。

本项目为独立社区项目，与 DeepSeek 官方无隶属关系。
