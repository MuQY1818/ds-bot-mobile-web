# 安装与安全使用

本插件安装在运行 DSH 和 DS Bot 的电脑上，为现有 Web 界面增加手机布局。手机通过浏览器访问这台电脑，无需在手机上安装 `.tgz` 文件。原有 Bot、群聊和会话继续由 DS Bot 管理。

本文对应 v0.2.0。版本和附件以 [Release](https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.2.0) 为准。先前 v0.1.3 的移动布局已在正式 DSH 0.2.1-rc.2 与 DS Bot 0.1.7 组合部署，并获得手机登录反馈；新入口的验证范围见[验证说明](validation.md)。

## 已有DSH用户

### 1. 确认安装位置

在电脑上打开你平时使用的 DSH，确认 DS Bot 已启用，原有团队和会话能正常打开。安装时选择这套 DSH 当前使用的 profile，避免把插件装进另一套开发或测试环境。

插件运行需要已有 DSH 和 DS Bot。它不替换 DS Bot，不导入第二套团队，也不内建公网隧道。手机能否访问电脑，还取决于你的网络入口和 DSH 认证配置。Tailscale 是可选的私网方案，不是插件的必装依赖；网络配置见[远程访问](remote-access.md)。

如果已有其他布局插件，建议先在隔离测试环境使用模拟数据验证组合，不复制生产 profile。正在运行桌面 DSH 时，不要再启动第二套 profile。先记下当前版本，并保留现有安装包，便于回退。

### 2. 下载发布包并核对 SHA-256

在电脑上打开 [v0.2.0 发布页](https://github.com/MuQY1818/ds-bot-mobile-web/releases/tag/v0.2.0)，从同一次 Release 的附件下载：

- `ds-bot-mobile-web-0.2.0.tgz`
- `SHA256SUMS`

将两份文件放在同一目录。后续版本使用对应文件名，不要混用不同版本的安装包和校验文件。GitHub 自动生成的源码压缩包不能替代这里的插件 `.tgz`。

SHA-256 可以检查下载内容是否与发布者提供的校验值一致，不等于对插件代码做过安全审计。请从本项目的正式 Release 获取包和校验文件。

macOS：在终端进入下载目录后运行：

```sh
shasum -a 256 -c SHA256SUMS
```

Linux：

```sh
sha256sum -c SHA256SUMS
```

macOS 和 Linux 应显示所需 `.tgz` 校验通过。若清单还列出其他附件，需要把这些附件一并下载，或单独核对所用 `.tgz` 对应的哈希；缺少其他附件不等于当前包损坏。

Windows：在 PowerShell 进入下载目录后运行：

```powershell
Get-FileHash -Algorithm SHA256 .\ds-bot-mobile-web-0.2.0.tgz
Get-Content .\SHA256SUMS
```

比较 `Hash` 列与清单里同名文件的完整哈希。十六进制字母大小写不影响比较。若不一致，停止安装并重新下载；不要改写清单来匹配下载结果。

### 3. 在电脑的 DSH 中安装

1. 在运行 DSH 的电脑上打开现有的官方插件管理器，使用它提供的本地包安装入口。
2. 按管理器要求选择或填写刚下载的 `.tgz` 在这台电脑上的路径。路径来自电脑的下载目录，不是手机目录，也不是 GitHub 页面地址。手机浏览器不能指定电脑本机的 tgz 路径。
3. 等待管理器检查包信息，确认名称为 `ds-bot-mobile-web`，版本与你下载的 Release 一致。
4. 如果管理器提供安装后再启用的选项，可以先保持停用，核对信息后再启用该 bundle。
5. 等待安装和启用操作完成。仅把路径填进输入框，还没有安装成功。
6. 刷新原来的 DSH Web 页面。手机宽度下会显示移动导航；电脑宽屏继续使用桌面布局。

若管理器提示需要重启，请按它的提示操作，并在重启后重新打开当前入口；不要反复启动额外宿主。安装失败时先看错误内容，[故障排查](troubleshooting.md)列出了常见情况。

包管理器可能检查整份依赖锁文件。因此，即使下载的是本地插件包，也可能被其他已有依赖的发布冷静期拦住。默认等待策略允许后再试，不建议全局关闭安全策略或删除锁文件。

### 4. 在手机上登录

先让手机能够访问这台电脑上的 DSH，再完成登录。这是两个独立条件：只打开可达域名，不一定已经获得会话权限。

1. 保持电脑和 DSH 运行。手机连接与电脑可互通的私网，或使用已有的 HTTPS 入口。
2. 在电脑本机点击 DS Bot 左下角账户按钮，从菜单选择“手机访问”。
3. 检查面板提示。如果没有可用地址，填写已有的 HTTPS 入口，点击“保存并检查”；域名必须已经被宿主信任。详见[远程访问](remote-access.md)。
4. 入口就绪后，用手机相机扫描二维码，或点击“复制登录链接”并私密传给自己的手机。剪贴板被拒绝时，可展开“手动复制登录链接”。
5. 手机浏览器完成官方登录后，打开一个已有 Bot 或群聊，确认会话可以查看。

二维码和复制按钮都由同一官方登录链接生成，插件不会另建认证或 bridge 配对流程。宿主重启后重新打开面板；“刷新入口”不等于撤销已经复制的链接。手机登录后的日常访问可使用同一入口的普通地址。

`127.0.0.1` 和 `localhost` 都表示“当前设备自己”。电脑上的本机地址直接填到手机里，会指向手机自身。不要手动把官方签名登录链接中的 `localhost` 或 `127.0.0.1` 替换为局域网 IP、私网域名或公网域名：签名可能绑定入口主机，修改后可能无法登录。应先配置可达入口，再由 DSH 为该入口生成完整登录链接。

二维码和签名登录链接含访问权限。不要贴到公开 Issue、截图、录屏或群聊中。普通入口地址和含权限的登录链接也应分开保存；遇到登录失效时，从电脑重新获取登录链接，不要公开旧链接求助。

日常使用与布局切换见[使用说明](usage.md)。如果手机显示 `dsh web authentication required; reopen the URL printed by dsh web.`，说明请求已到达宿主，但当前手机浏览器还没有有效登录会话，按[认证错误处理](troubleshooting.md#手机显示-authentication-required)重新登录，不建议先清空全部 cookie。

独立 Web 用户若已有名为 `web`、管理同一团队的 profile，可参考已核对的官方 CLI 形式：

```sh
dsh --profile web --port 8080 --public-url https://dsh.example.com/ --trusted-host dsh.example.com
```

此示例仅适用于上述独立 Web 用户。已运行桌面 DSH 的用户不要因此启动第二套 profile。`--public-url` 只改展示地址，不会授信；`--trusted-host` 必须精确匹配访问地址的 authority（主机名及适用时的端口）。这不是完整公开配置链路，监听、代理和认证配置参见[远程访问](remote-access.md)，不要自行改写签名链接。

## 从源码构建

需要 Git、Node.js 24 或更新版本，以及 npm。首次克隆时同时取得固定的上游 submodule：

```sh
git clone --recurse-submodules https://github.com/MuQY1818/ds-bot-mobile-web.git
cd ds-bot-mobile-web
npm run setup
npm run check
npm run build
npm run pack
```

已有克隆先运行：

```sh
git submodule update --init --recursive
```

保留仓库固定的 submodule 提交，不要为了完成安装随意切换到上游最新分支。构建会使用这些源码中的必要精灵组件；运行时仍使用现有 DSH 和 DS Bot。

`npm run pack` 在 `artifacts/` 生成插件包和发布元数据。检查 `artifacts/release.json` 中的版本、commit、`dirty=false` 和 SHA-256，确认它们对应当前包。源码树不干净时，不要把产物当作可复现的正式发布包。

安装包不依赖开发者的本机目录。`setup` 安装开发依赖和公开 npm DSH 测试 harness，测试使用隔离 fixture，不需要真实模型密钥。测试 harness 不应另装成生产宿主；也不要把测试 home 指向自己的真实 profile。上述构建命令的执行结果不能证明手机已登录、网络可达或 Safari 真机测试通过。

## 独立mock预览

开发者可使用仓库提供的隔离预览：

```sh
python3 scripts/mock-bench.py
```

运行前确认 Python 3 可用，默认端口未被其他进程占用。脚本默认只监听 loopback 的 3298 与 8899；按 `Ctrl-C` 停止本运行器创建的子进程。不要为了腾出端口停止日常 DSH 或其他人的测试服务。

测试 home 在被 Git 忽略的 `scripts/` 目录下，不复制生产 profile 或凭据。预览只使用公开 npm 包和仓库 mock 模型。登录助手 `scripts/browser-login.mjs` 只用于这套独立 fixture；请在自己的浏览器自动化环境调用，不打印 token、cookie 或原始启动日志。这个 loopback 预览地址也不能直接在另一台手机上访问。

## 回滚

页面内的“原版”按钮可以切回原布局，“手机布局”按钮可再次开启；选择保存在当前浏览器。DSH 插件设置页中的“手机布局”开关与页面内开关使用同一偏好。

要停用整个插件，在 DSH 插件管理器里停用 `ds-bot-mobile-web` bundle，再刷新页面。原 DS Bot、团队和会话继续保留。不要删除 DS Bot 或清空团队来回退一个布局插件。

升级前保留旧版 `.tgz` 和对应校验值，记录新旧版本。通过官方管理器停用新增 bundle，再安装新版；如果管理器要求先卸载旧版，只处理 `ds-bot-mobile-web`，并先核对数据保留提示。回退时优先停用，再按当前管理器支持的流程重新安装保留的旧包。卸载也可能被冷静期的全锁检查阻挡；此时先停用 bundle 并刷新，等待策略允许后再继续。不要删除锁文件或全局关闭策略，维护者可审核具体依赖的精确例外条件。

## 当前状态

v0.2.0 增加桌面内部协议、桌面转发请求和菜单尺寸修复；对应本地修复版已在实际 DSH Desktop 窗口验证启动、菜单和二维码。账户菜单、地址保存、复制反馈及窄屏检查的较早隔离证据来自 v0.1.4。先前 v0.1.3 已完成正式移动布局部署和手机登录；两者的测试范围分别记录在[验证说明](validation.md)。

Chromium 窄视口检查不能代替 iPhone Safari 的软键盘、安全区、锁屏和长时间后台测试。第三方插件在运行时注册的精灵形状也不一定与本插件单独打包的 registry 共享。具体边界见[验证范围](validation.md)、[架构与边界](architecture.md)及[故障排查](troubleshooting.md)。

## 从旧包名迁移

0.2.0 使用正式包名 `ds-bot-mobile-web`。先停用旧 `dsh-mobile-layout-local` bundle，再安装/启用新版并刷新。旧配置行身份与浏览器布局偏好有意保留，手机入口地址不会被重置。确认新包正常后，可单独移除已停用的旧包；无需重建团队或重新配对。
