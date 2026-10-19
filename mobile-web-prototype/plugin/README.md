# DS Bot Mobile Web

为现有 DSH / DS Bot 增加手机浏览器界面。电脑安装插件，手机通过浏览器访问同一支团队；无需原生 App 或 Mobile Bridge。

## 安装与连接

1. 从[发布页](https://github.com/MuQY1818/ds-bot-mobile-web/releases)下载 `ds-bot-mobile-web-0.4.5.tgz`，在现有 DSH 插件管理器安装并启用。
2. 准备手机可达的 HTTPS 入口，保持电脑和 DSH 运行；使用私网时，两端都要连入对应网络。
3. 在电脑账户菜单打开 **手机访问 → Web**，确认入口就绪后扫码登录。

保留现有 Bot、群聊、消息和宿主输入逻辑。手机有效发送后收起键盘，桌面宽屏保留原有焦点。基础资源缓存与近期会话预热减少重复加载；首次下载、恢复连接和读取历史仍需要网络。

- [安装与升级](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/installation.md)
- [日常使用与添加桌面](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/usage.md)
- [常见问题](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/faq.md)

账户菜单不可用时，可从官方插件配置页打开相同的手机访问弹窗。停用本插件会撤除移动界面，原 DS Bot 和团队保留。二维码和完整登录链接仅供自己的设备使用。

Apache-2.0；版权和依赖来源见 LICENSE / NOTICE。
