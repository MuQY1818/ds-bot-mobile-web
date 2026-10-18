# DS Bot Mobile Web

为现有 DS Bot 增加手机 App 风格布局的独立 DSH 插件。保留原版会话、输入框、流式回复、群聊、工具和交互卡片；不替换上游 DS Bot，不创建第二套 Bot 运行时。

此仓库只存源码、生成的客户端发布文件、测试、构建说明和许可，不包含用户团队、聊天记录、登录凭据、生产配置、依赖目录或浏览器录屏。

## 目录

- `mobile-web-prototype/plugin/`：实际移动布局插件 `dsh-mobile-layout-local`，版本0.1.2。
- `mobile-host-adapter/`：公开宿主协议适配、可选会话投影封装与隔离契约测试。
- `ds-bot-upstream/`：固定提交的上游 Git submodule，供精灵组件构建和真实上游通道测试使用；不会作为另一个运行时安装。
- `docs/`：架构、验证边界和版本记录。
- `scripts/`：构建、验证及发布检查。

## 获取与构建

需要 Git、Node.js24+ 和 npm。初次克隆时需一并获取固定版本的上游源码：

```sh
git clone --recurse-submodules <本仓库地址>
cd ds-bot-mobile-web
npm run setup
npm run check
npm run build
npm run pack
```

已有克隆先执行 `git submodule update --init --recursive`。`setup`只在本仓库安装开发依赖和公开npm DSH测试harness，不读取用户DSH_HOME。默认测试home位于仓库内的忽略目录。

`build`重建插件的 `client.js`；React由现有DSH客户端提供。`pack`在被忽略的 `artifacts/`生成安装tarball。插件运行时无额外npm依赖，不包含安装生命周期脚本。

## 使用方式

用现有DSH公开插件管理器加装构建出的 `dsh-mobile-layout-local` bundle，刷新现有Web入口。不要把它作为另一套DS Bot安装。手机列表通过公开团队接口解析当前会话，再用 `uiWorkspace.openSession`导航；实际发送继续走原版composer的 `/api/session/prompt`。

首次安装可先保持新增 bundle 停用，审核后再启用；回滚时停用新增 bundle 并刷新页面。布局中的“原版”按钮也能撤去当前页的手机样式。继续使用现有认证和私有网络入口，不关闭 Host/Origin 检查，也不公开宿主。

## 精灵与许可

0.1.2将字母占位头像替换为上游 `BotAvatar`、`RoomAvatar` 与 `botState`，保留原图形和工作状态，使用现有DS Bot动效CSS。构建只为SVG mask改用独立命名空间，避免同页冲突。详见插件 `NOTICE` 与根目录 `NOTICE`；上游源文件保持在固定submodule中。

## 验证边界

已在公开npm DSH0.2.0-rc.2、DS Bot0.1.7和仓库mock模型的独立组合验证正文增量、群归属回复、离线草稿恢复及手机布局。0.1.2精灵动态验收按对应版本记录执行。测试不代表iPhone Safari真机软键盘、安全区、长时间后台恢复或“提交已接受但确认丢失”全部通过。

当前CSS依赖宿主公开data标记及部分编译class后缀；升级DSH后须回归布局。参考 `docs/architecture.md`、`docs/validation.md`与`CHANGELOG.md`。
