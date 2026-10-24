# 架构与边界

## 会话与导航

移动插件通过公开 `shell.overlay` 贡献手机导航和响应式样式，使用 `sessions`、`uiWorkspace`、`connection`、`slots`。列表请求同源 `api/bot`，Bot 按当前 `sessionId` 导航，群使用公开 room id，不订阅隐藏的群成员 Session。

聊天保留原 DSH／DS Bot renderer 和 composer。消息提交仍由原版的 `/api/session/prompt` 处理，连接与流式恢复也由宿主负责。布局插件不因前台恢复而自动重发草稿。

`mobile-host-adapter/conversation-feed.mjs` 是可选协议封装，只在已有 DSH 客户端组合中处理 retain、ready、逐节点订阅、翻页与释放。它不是一个可独立部署的静态聊天运行时，手机 Web 不需要另装原生 bridge。

## 会话历史缓存

v0.3.0 使用公开 `sessions.retain()` 为最近 3 个逻辑会话增加引用，5 分钟无访问后按 LRU / TTL 释放。用户切换会话时，宿主的规范 Client Session 仍可复用，不再因为最后一个视图引用释放而销毁并重新加载整段历史。缓存只有引用，不复制消息或存储凭据。

每次打开仍请求服务器确认 Bot / 群的当前 Session；Session 轮换、删除或 401 / 403 会释放对应缓存。临时网络错误保留已访问引用，不使用旧身份绕过服务器校验。手机布局关闭、进入桌面宽屏和插件卸载时释放；后台、冻结和页面往返缓存只暂停可选预热及取消旧读取，不再额外执行 30 秒清理。原有 LRU / TTL 继续生效。

这是有界内存缓存，不是离线数据库。刷新页面、Safari 回收页面、超过最近 3 项或 5 分钟后仍需重新加载。短暂前台恢复只同步数据；后台超过 15 秒或网络恢复后调用宿主公开 `connection.reconnect()`，自动重连至少间隔 15 秒。元数据及目录恢复读取最多等待 12 秒，取消和超时都会释放本插件的等待者；宿主不提供取消参数的目录读取由后续连接代次替换。缓存和连接恢复均不重发用户输入。

0.4.17 对状态读取的 401 增加一次同源、`no-store` 的受保护首页 HEAD 检查，仍复用浏览器 cookie。首页允许访问时，最多重试一次状态读取；再次拒绝按同步故障恢复，保留增量版本和近期引用。首页也返回 401 / 403 才按相应拒绝清理，网络错误和超时不推断登录过期。检查与重试共享原有取消和 12 秒超时；消息提交不进入此路径。

## 三插件分工

| 插件 | 职责 | 运行依赖 |
| --- | --- | --- |
| `ds-bot-mobile-web` | 手机浏览器界面、DSH 浏览器登录入口 | DSH + DS Bot |
| `ds-bot-mobile-app` | 原生 App 配对、批准与设备管理 UI | 操作时需要 Mobile Bridge |
| `ds-bot-mobile-bridge` | 设备凭据、HTTP / WebSocket 协议与撤销 | DSH + DS Bot |

三个插件独立启停。[App 仓库](https://github.com/MuQY1818/ds-bot-mobile-app)维护原生客户端与 App 配套界面；[Bridge 仓库](https://github.com/MuQY1818/ds-bot-mobile-bridge)维护设备认证和传输。原生客户端运行在手机上，配套插件运行在电脑上。Web 浏览器登录码与 App 设备配对码不可互换；Web 用户只需 Web 插件。

## 手机访问入口

v0.1.4 的账户菜单没有修改原 DS Bot 源码。DS Bot 当前未提供公开的账户菜单项插槽，因此插件只观察 `document.body` 的直接子节点，在 `.bt-account-menu` 出现时加入一个自己的入口，关闭或停用时移除。它不观察整棵流式消息 DOM，也不复制原菜单或覆盖原操作。

弹窗通过公开 `shell.overlay` 注册。DSH 插件设置页“手机布局”提供同一入口，作为菜单适配失效时的备用路径。这个 DOM 适配仍有上游升级风险，需要回归，不能称为完全脱离 DOM 的接口集成。

## 地址与官方认证

宿主插件声明 `phoneUrl` 为可实时更新的配置字段。浏览器通过公开 `configForms` 保存这个干净地址；留空时读取公开 `webApp.getAdvertisedUrl()`。地址设置不等于网络转发或域名授信，插件不会修改 `trustedHosts`、Tailscale、DNS 或防火墙。

`POST /api/dsh-mobile-layout/phone-access` 用于检查入口或取得当前官方登录链接。它要求：

- 请求来自本机 socket，Host 是当前监听端口的本机地址，并带同源 Origin。
- 使用 DSH `connection.admit()` 验证，且属于宿主的浏览器所有者 Peer；其他 API Peer 不能签发浏览器登录凭据。
- JSON 请求不超过 2 KiB；不接受任意字段、未知动作或跨源请求。
- 目标是干净的非本机 HTTPS 地址，且通过宿主精确 Host／Origin 信任检查。

通过后，插件调用公开 `connection.authenticatedUrl()`，并检查返回 URL 的 authority、挂载路径和查询字段。前端不会把本机 token URL 改写成远程主机名。接口不 fetch 用户填写的地址，也不执行网络配置命令。

响应使用 `no-store, private` 和 `no-referrer`。登录链接只在面板打开时保存在内存中，关闭、取消请求或卸载时清理，不放入 localStorage、历史记录、日志或分析事件。二维码编码器直接在浏览器中生成黑白 SVG，不向第三方二维码服务发送链接。

关闭弹窗清理的是本插件持有的凭据，不会撤销已经复制的链接或现有会话。“刷新入口”也不承诺轮换 DSH 的进程凭据。宿主重启后的链接和会话行为由 DSH 认证配置决定。

## 样式、精灵与生命周期

布局偏好保存在当前浏览器；关闭手机布局后停止定期团队刷新。停用 bundle 会释放会话与设置订阅、定时器、窗口监听、菜单适配、弹窗和样式，并注销宿主路由、恢复 viewport。

精灵由固定上游的 `mark.js` 及必要依赖在构建时打包，使用原 DS Bot 的动效样式和真实工作状态。独立 SVG mask 命名空间避免同页冲突。内置形状、配置颜色和头像图片受支持；第三方插件运行时自注册的 shape 位于另一份 registry，不保证自动共享。

响应式样式仍依赖部分宿主 DOM 标记与 class 后缀。DSH／DS Bot 更新、其他布局插件、Bot／Agent 模式以及 Safari 软键盘和后台恢复都需要按[验证说明](validation.md)回归。插件不 patch DSH 核心，也不读取安装包内部文件。

## 统一手机访问

Web 0.4.0 与 App 配套0.2.0各自注册模式，使用相同的版本化页面 registry 协调唯一菜单和弹窗。菜单由确定性 leader 提供；leader 停用后另一个包接管，当前模式停用则回到剩余模式，最后卸载撤除全部共享界面。registry 只保存 provider 元数据和导航状态，不保存登录 URL、二维码或设备凭据。

切换标签会卸载旧模式组件。Web 取消请求并清空登录 URL；App 释放对应 controller、轮询和二维码。每种模式的 owner 认证与网络接口保持原有约束，Web 登录二维码和 App 配对二维码不可互换。两包应升级到兼容的统一入口版本，旧包不具备该协议。
