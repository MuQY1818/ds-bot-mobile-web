# DS Bot 移动布局插件

`dsh-mobile-layout-local@0.1.3` 为现有DSH Web增加手机导航、列表和布局，保留原版会话、输入框、流式回复、群聊、工具卡片和附件入口，不创建第二套Bot运行时。

## 构建与安装

从仓库根执行 `git submodule update --init --recursive`、`npm run setup`、`npm run check`、`npm run build`和`npm run pack`。需要Git、Node.js24+和npm。上游以固定submodule提供，精灵在构建时打包；React由现有DSH提供。

在现有DSH插件管理界面安装生成的 `artifacts/dsh-mobile-layout-local-0.1.3.tgz`，启用bundle后刷新页面。命令行安装先查当前版本 `dsh plugin --help`，确认目标profile和本地包参数。不要关闭认证、创建第二套DS Bot或替换团队。回滚仅停用新增bundle并刷新；当前页可用“原版”按钮撤去手机样式。

## 布局开关与清理

DSH 插件设置页的「手机布局」提供「启用手机布局」开关，与页面内「原版」和「手机布局」按钮同步。选择只保存在当前浏览器的 localStorage，不修改团队或宿主配置。停用 bundle 后会移除界面、样式、窗口监听、轮询和订阅，恢复原 viewport；浏览器保留布局偏好，便于重新安装时沿用。

## 公开接法

通过 `shell.overlay`贡献导航，使用同源 `api/bot`取得团队摘要，再通过 `uiWorkspace.openSession`进入原版main会话。聊天和发送继续由原renderer/composer处理；原版提交走 `/api/session/prompt`，不同于可选适配器的简化send。恢复时同步现有Session与团队，不自动重发消息，不因回前台强制重连。插件不读取Cookie/token，也不导入安装内部文件。

## 精灵与许可

构建复用固定上游Apache-2.0的BotAvatar/BotMark/RoomAvatar/botState及角色资源，保留avatar、颜色、工作状态和群成员组合。SVG mask命名空间改为 `dsm-mark-`避免同页冲突。动效CSS来自现有DS Bot，尊重motion偏好和系统减少动态效果。来源和改动见NOTICE、LICENSE。

## 兼容与验证状态

独立组合环境为公开npm DSH0.2.0-rc.2、上游DS Bot0.1.7和仓库mock模型。已验证列表导航、正文增量、群归属、工具活动、离线草稿保留、恢复不自动重发、多种手机视口与精灵状态动画。9项前端控制器、14项宿主/订阅测试通过。

**正式宿主安装和iPhone Safari真机验收尚未完成。** 缩小视口不能代表软键盘或安全区；锁屏、长后台、网络切换、已接受但确认丢失仍有未覆盖场景。附件、问答和审批仅覆盖部分隔离流程。

CSS使用现有data标记和部分编译class后缀，这是随宿主升级回归的样式适配。其他布局插件、宿主更新和Bot/Agent模式切换需验证。公开仓库不包含聊天、截图、录屏、登录资料或设备配置。
