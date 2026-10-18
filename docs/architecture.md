# 架构与边界

移动插件贡献 `shell.overlay` 导航和响应式CSS，使用公开 `sessions`、`uiWorkspace`、`connection`、`slots`。列表请求同源POST `api/bot`，格式 `{endpoint,payload}`；Bot以当前sessionId导航，群使用公开room.id。不会订阅隐藏群成员Session。

实际聊天保留原DSH/DS Bot renderer和composer。原版提交走 `/api/session/prompt`，使用Session submission/requestId，区别于可选适配器的 `/api/bot` send。连接恢复由DSH自身Mux和seq修复负责；布局不自动重发消息。

`mobile-host-adapter/conversation-feed.mjs`仅在已有DSH客户端组合里可用，负责retain/ready、Chat目标和逐节点订阅，以及翻页、关闭释放。它不是独立静态HTML的DSH运行时。

精灵由固定上游的mark.js及依赖在构建时打包；运行时沿用现有DS Bot动效CSS、真实工作状态与motion偏好。独立SVG mask命名空间避免与原版同页重复ID。内置形状、配置颜色和头像图片受支持；其他插件在运行时自注册的shape位于各自模块registry，不会自动共享到这里单独打包的精灵registry，不能承诺第三方自定义形状完全一致。

CSS仍依赖宿主DOM标记和部分class后缀。宿主升级、其他布局插件、Safari键盘和安全区均须实测。只通过公开插件管理加装/停用，不patch宿主、不导入安装内部文件、不迁移用户数据。
