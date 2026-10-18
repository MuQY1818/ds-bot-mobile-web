# DS Bot 移动布局插件

`ds-bot-mobile-web@0.4.1` 为现有 DSH Web 增加手机会话界面和电脑端的扫码登录弹窗。它保留原版会话、输入框、流式回复、群聊和交互卡片，不创建第二套 Bot 运行时。

## 安装与更新

在运行 DSH 的电脑上，通过官方插件管理器安装 Release 附件 `ds-bot-mobile-web-0.4.1.tgz`，先核对同次发布的 `SHA256SUMS`，再启用并刷新。手机不用安装这个压缩包。

完整教程：[安装](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/installation.md)、[远程访问](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/remote-access.md)、[故障排查](https://github.com/MuQY1818/ds-bot-mobile-web/blob/main/docs/troubleshooting.md)。

升级前保留旧包和校验值。回退优先通过管理器停用本新增 bundle 并刷新；不要删除 DS Bot、团队或会话。

## 手机访问

在电脑本机点击 DS Bot 左下角账户按钮，在“用量、连接器、Bot 设置”所在菜单中选择“手机访问”。面板提供二维码、复制登录链接、手动复制和刷新入口。

如果没有可用地址，填写已经配置好的 HTTPS 手机入口并保存。该字段只记录地址，不创建隧道或添加域名信任；目标必须已经被宿主信任。使用已有私网时，手机也需要连接该私网。

链接由宿主公开的 `connection.authenticatedUrl` 生成，二维码在本地编码。只有本机、同源、当前端口且已认证的浏览器所有者请求可以签发。远程手机页面不能为其他设备生成登录链接。二维码和完整链接包含访问权限，请只发给自己的设备。关闭面板清理界面中的链接，但不撤销已复制的链接；宿主重启后重新获取。

DS Bot 账户菜单暂无公开菜单项插槽。独立入口通过限定的 `.bt-account-menu` DOM 适配加入，停用时移除；没有修改原 DS Bot 或 DSH 核心。菜单升级不兼容时，可从 DSH 插件设置页的“手机布局”打开同一面板。

## 布局开关与清理

在官方插件管理器的本包详情页调整“启用手机布局”；选择保存在当前浏览器。聊天页已取消“原版”布局切换按钮。停用 bundle 会移除界面、样式、监听、定时器和订阅，注销手机访问路由，恢复 viewport。浏览器布局偏好与宿主中保存的干净入口地址会保留。

## 构建

从仓库根执行：

```sh
git submodule update --init --recursive
npm run setup
npm run check
npm run build
npm run pack
```

需要 Git、Node.js 24+ 和 npm。固定上游只为构建提供必要精灵组件，不会另装成生产 DS Bot。React、React DOM 和公开 schema 服务由现有 DSH 提供；二维码依赖构建时打包。包不含安装生命周期脚本。

## 接口与兼容

导航使用公开 `shell.overlay`、`sessions`、`uiWorkspace`、`connection` 和 `slots`；入口设置使用公开 `configForms`。手机摘要来自同源 `api/bot`，发送仍走原 composer。恢复时不会新增自动重发。

目标组合为 DSH `0.2.1-rc.2`、DS Bot `0.1.7`。已验证范围及限制见仓库的 `docs/validation.md`。窄屏 Chromium 不代表 iPhone Safari 的软键盘、安全区、锁屏和长后台全部通过。第三方运行时自注册精灵形状也不一定共享到本插件的独立 registry。

精灵来源、SVG mask 调整、二维码编码器及其依赖的版权文本见 `NOTICE` 和 `LICENSE`。文档图片的来源、用户授权和处理范围见仓库 `docs/images/README.md`；不公开访问凭据或设备配置。

当前统一入口从“手机访问 → Web”登录浏览器；兼容的App配套插件启用时增加App标签。两包单独启用仍可用，切换标签会清理上一模式的二维码与请求。
