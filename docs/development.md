# 开发指南

本页用于源码开发、隔离验证和安装包制作。日常手机使用请从[安装指南](installation.md)开始，无需执行这里的命令。

## 环境与克隆

准备 Node.js **24**、npm、Git 和 Python 3。仓库包含固定版本的 DS Bot submodule，克隆时一并取得：

```sh
git clone --recurse-submodules https://github.com/MuQY1818/ds-bot-mobile-web.git
cd ds-bot-mobile-web
npm run setup
```

已克隆但未取得上游源码时，在仓库根目录运行 `git submodule update --init --recursive`。`npm run setup` 执行固定上游的 harness 准备流程，再按锁文件安装 Web 插件依赖；需要联网读取包仓库。

这些操作准备开发依赖，不会把 Mobile Web 安装到日常 DSH profile。运行态验证使用隔离目录和 mock 模型。

## 代码与职责

| 路径 | 内容 |
| --- | --- |
| `mobile-web-prototype/plugin/src/` | 响应式界面、主题、导航、会话保留和手机访问前端。 |
| `mobile-web-prototype/plugin/index.mjs` | 插件注册与公开宿主接口接入。 |
| `mobile-web-prototype/plugin/phone-access.mjs` | 入口检查和官方浏览器登录链接签发边界。 |
| `mobile-web-prototype/plugin/web-startup.mjs` | 启动反馈与静态资源缓存接入。 |
| `mobile-host-adapter/` | 会话订阅、请求合并和宿主客户端适配。 |
| `scripts/` | 检查、资源审计、打包与隔离交付验证。 |
| `ds-bot-upstream/` | 固定上游 submodule，保留原始来源与许可。 |
| `docs/` | 用户指南、设计、架构和按版本记录的验收证据。 |

插件使用公开 DSH API，并对部分宿主 DOM 做有界适配。升级 DSH / DS Bot 后应按[架构边界](architecture.md)回归；不要直接 patch 上游或测试用户的真实 profile。

## 日常检查

在仓库根目录执行：

```sh
npm run check
npm run build
npm run audit:files
```

| 命令 | 验证什么 |
| --- | --- |
| `npm run check` | 插件、手机入口、会话缓存、轮询和宿主适配检查。 |
| `npm run build` | 用固定上游组件生成可分发的 `mobile-web-prototype/plugin/client.js`。 |
| `npm run audit:files` | 仓库文件与来源边界审计。 |

CI 使用 Node.js 24 执行这些流程，并检查重新构建后 `client.js` 是否与提交一致。涉及客户端代码时提交必要的生成产物，不手工编辑生成文件。

纯文档修改检查相对链接、截图引用、版本和命令即可，无需重跑全部运行态验收。界面、网络或生命周期行为修改应补充对应的隔离宿主验证；[验证记录](validation.md)说明现有覆盖范围。

## 制作与验证插件包

先完成并提交源码和生成产物。根目录与插件版本号必须一致，工作树应干净：

```sh
npm run pack
npm run check:delivery -- artifacts/ds-bot-mobile-web-0.4.6.tgz
```

`pack` 会重新构建、校验显式包成员清单，并在 `artifacts/` 生成 `.tgz` 与对应源码提交的发布记录。上例对应当前 `0.4.6`；修改版本后，按实际生成文件名调整第二条命令。

`check:delivery` 会建立新的隔离 DSH profile，使用 mock 模型，并通过正式插件管理器执行安装、启用、停用、重新启用和卸载检查。它不使用日常团队。检查完成后仍需按变更范围确认真实浏览器行为；包生命周期通过不等同于所有 Safari 真机组合通过。

制作本地包不等于发布。Release 附件应对应已审查源码和打包结果；已发布标签与附件保持不变。

## 提交变更

为一次完整改动创建独立分支，在 Pull Request 中说明问题、修改后的行为、执行过的验证和未覆盖范围。文档同步中文 / 英文 README；界面截图使用示例数据，并注明浏览器和版本，避免替换用户指定的来源图片。

贡献约定见 [CONTRIBUTING](../CONTRIBUTING.md)。版权、固定上游提交与依赖声明见 [NOTICE](../NOTICE) 和[插件 NOTICE](../mobile-web-prototype/plugin/NOTICE)。
