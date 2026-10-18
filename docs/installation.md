# 安装与安全使用

## 已有DSH用户

1. 保留已有DSH和DS Bot；推荐先在独立profile验证与其他布局插件的组合。
2. 从本项目Release下载安装包和SHA256SUMS，并核对SHA-256。
3. 在DSH插件管理界面安装本地包，启用 `dsh-mobile-layout-local` bundle。
4. 刷新原Web页面。手机视口显示新导航和精灵，桌面宽屏保持原布局。
5. 通过原有已认证的网络入口访问。访问方式由你自己的私有网络或安全反向代理提供，本插件不会部署隧道、修改DNS或开放端口。

如果包管理器因安全冷静期拒绝安装，请等到满足策略后再试，不要关闭安全策略或删除已有锁文件。

## 从源码构建

```sh
git clone --recurse-submodules https://github.com/MuQY1818/ds-bot-mobile-web.git
cd ds-bot-mobile-web
npm run setup
npm run check
npm run build
npm run pack
```

检查 `artifacts/release.json`中的commit、dirty=false和SHA-256。安装包不依赖本机开发路径。运行所需DSH/DS Bot由现有宿主提供，测试harness不作为另一套生产运行时安装。

## 独立mock预览

```sh
python3 scripts/mock-bench.py
```

默认只监听loopback的3298与8899；`Ctrl-C`停止本运行器创建的子进程。测试home在被Git忽略的scripts目录下，不复制生产profile或凭据。只使用公开npm和仓库mock模型。登录助手 `scripts/browser-login.mjs` 只处理此独立fixture；请在你自己的浏览器自动化环境调用，不打印token、cookie或原始启动日志。

## 回滚

页面内“原版”可立即撤去手机样式。完整回滚用DSH插件管理界面停用新增bundle后刷新；原DS Bot、团队会话、认证和访问入口继续保留。不需要清空数据或重新创建团队。

## 当前状态

隔离环境验证已完成，正式宿主安装和 iPhone Safari 真机验收仍未完成。这是预览版；Chromium 窄视口测量不能代替 iPhone 键盘、安全区或长时间后台恢复测试。具体范围见 validation.md。
