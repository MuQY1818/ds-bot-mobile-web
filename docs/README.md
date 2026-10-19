# DS Bot Mobile Web 文档

在手机浏览器中使用电脑上已有的 DS Bot 团队。当前发布版本为 **0.4.6**，适配 DSH `0.2.1-rc.2` / DS Bot `0.1.7`。

[项目首页](../README.md) · [English overview](../README.en.md) · [下载插件](https://github.com/MuQY1818/ds-bot-mobile-web/releases/latest) · [更新记录](../CHANGELOG.md)

## 第一次使用

1. [安装与连接](installation.md)：把 `.tgz` 安装到现有电脑 DSH，启用插件。
2. [网络与登录](remote-access.md)：确认手机可访问 HTTPS 入口，并从电脑取得 Web 登录二维码。
3. [手机使用指南](usage.md)：继续原有会话、切换外观、发送消息和添加桌面入口。

只使用 Mobile Web 时，不需要原生 App、App 配套插件或 Mobile Bridge。电脑与网络入口需要保持运行。

## 按问题查找

| 主题 | 内容 |
| --- | --- |
| [安装与升级](installation.md) | 发布包选择、升级、回退、旧包名迁移。 |
| [手机使用](usage.md) | 导航、主题、键盘、桌面入口与日常连接。 |
| [常见问题](faq.md) | 缓存范围、离线边界、电脑休眠及 Web / App 区别。 |
| [故障排查](troubleshooting.md) | 地址打不开、认证失效、入口缺失、发送和历史加载。 |
| [网络与登录](remote-access.md) | 已有 HTTPS 入口、Tailscale、精确宿主信任与浏览器认证。 |
| [网络方案研究](remote-connectivity.md) | 隧道和自建 relay 的可选架构；不代表已实现这些服务。 |

## 了解支持范围

| 文档 | 用途 |
| --- | --- |
| [当前状态](status.md) | 当前已发布能力与仍需完善的平台行为。 |
| [验证记录](validation.md) | 按版本区分自动检查、隔离浏览器、正式安装和真实设备证据。 |
| [性能记录](network-performance.md) | 缓存、请求合并、启动测量与观察边界。 |
| [设计说明](design.md) · [图片来源](images/README.md) | 交互设计、截图版本、示例数据与隐私处理。 |
| [0.4.6 说明](releases/v0.4.6.md) · [CHANGELOG](../CHANGELOG.md) | 当前主题和精灵修复及完整版本历史。 |

截图展示对应版本的实际界面，不能代替全部浏览器和设备验收。性能数据保留测量条件，不作为所有网络的延迟承诺。

## 开发与贡献

从[开发指南](development.md)开始克隆、安装依赖和运行检查，再阅读[架构](architecture.md)与[贡献指南](../CONTRIBUTING.md)。测试使用隔离 DSH profile 和 mock 数据，不连接日常团队。

| 项目 | 职责 |
| --- | --- |
| [Mobile Web](https://github.com/MuQY1818/ds-bot-mobile-web) | 浏览器布局、导航和 Web 登录入口。 |
| [Mobile App](https://github.com/MuQY1818/ds-bot-mobile-app) | 原生客户端与电脑端配对管理界面。 |
| [Mobile Bridge](https://github.com/MuQY1818/ds-bot-mobile-bridge) | 原生设备的认证与传输；Web 无此依赖。 |

详细指南目前以简体中文维护，欢迎提交文档和翻译改进。
