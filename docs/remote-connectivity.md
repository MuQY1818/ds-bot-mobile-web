# 远程网络方案

调研日期：2026-10-18。本页说明可选架构，不代表已建立 Cloudflare 隧道或改变现有访问配置。

## ZCode 实际采用什么

[官方 ZCode](https://github.com/zai-org/ZCode)与社区 ACP 远程方案需要分别看待：

| 项目 | 已确认实现 | 与 Cloudflare 的关系 |
| --- | --- | --- |
| 官方 ZCode | 电脑和手机各自向 `wss://zcode.z.ai/ws` 建立出站 WebSocket，relay 转发协议消息 | 已查公开源码未发现内置 cloudflared |
| 社区 ACP Remote | 手机连接 Hub，Hub 再连接电脑 Bridge | 文档允许用外部 Cloudflare Tunnel / frp 映射 Hub |

官方 relay 包含身份验证、配对、心跳和透传。手机连接以 500ms 起步指数退避，最多 10 秒；心跳间隔约 8–12 秒，30 秒无 ACK 判定连接失效。恢复后通过 attach、snapshot / replay 校准状态。这些连接设计值得参考，但自建 relay 会新增托管、认证、可用性和运维责任。

社区文档里的 Cloudflare Pages 是静态网页托管，与把本地服务转发出去的 Cloudflare Tunnel 不同；没有证据表明社区项目会替用户自动创建隧道。

## Tailscale 与 Cloudflare

Tailscale 直连失败时会经 DERP 中继；中继位置和路径可能显著影响手机到电脑的延迟。应先区分网络往返慢、历史重载和浏览器渲染慢。v0.3.0 的历史引用缓存减少重复 follow，不能改变网络路由。

| 选择 | 地址与生命周期 | 适用情况 |
| --- | --- | --- |
| Tailscale | 私网设备身份，优先直连，必要时 DERP | 个人设备访问、现有私网 |
| Cloudflare Quick Tunnel | 每次启动随机域名，进程停止即不可用 | 短期测试；无 SLA、最多 200 个并发请求、不支持 SSE |
| Cloudflare Named Tunnel | 固定域名，连接器出站连接 Cloudflare | 持续使用，需要账号、域名及受控服务入口 |
| 自有 WebSocket relay | 自行维护域名、服务、协议与鉴权 | 需要免域名配对体验且可承担运维 |

Cloudflare 不保证在任意网络上比 Tailscale 快。切换前后应在同一手机、同一网络测量打开列表、首次会话、缓存返回、首条回复和后台恢复；持续观察连接稳定性。

## DS Bot 的推荐接入方式

现有三插件边界保留，网络转发作为可选基础设施。长期使用优先固定域名 Named Tunnel：

1. 准备 Cloudflare 账号及已托管的域名，分别确定浏览器与 Bridge 的 HTTPS 地址。
2. Web 域名转发到 DSH 的稳定本机入口，Bridge 域名转发到 Bridge listener；后者继续绑定 loopback。DSH Web 端口可能随重启变化，应使用受控稳定入口或随宿主生命周期更新精确 origin，不能把一次运行的端口写成通用配置。
3. DSH 精确信任 Web 的 Host / Origin，并将 Web 插件的 `phoneUrl` 设置为干净 HTTPS 地址；继续使用 DSH 签名登录。
4. Bridge 设置独立公开地址，继续通过短期配对、电脑批准、设备 access / refresh token 和撤销管理授权。地址变更后重新核对设备配对。
5. 在手机实际网络完成读写、WebSocket、断线恢复及未认证拒绝测试。确认新路径可用后再调整旧入口。

App SDK 将凭据绑定到 `serverUrl`。Quick Tunnel 地址变化后不能继续复用旧地址凭据，固定域名更适合持久配对。

Cloudflare Access 可提供额外入口保护，但当前原生 SDK 没有实现 Access 的浏览器 OAuth 或 service-token 流程；直接增加登录拦截会影响 App 协议请求。不可把共享服务秘密打进客户端，也不把随机域名当作访问授权。

无论选择哪种网络，都保留 DSH owner 登录与 Bridge 设备认证，不开放匿名 owner API，不通配信任 `*.trycloudflare.com`。Cloudflare 边缘升级可能断开 WebSocket，业务仍需心跳、重连及状态恢复。

## 资料

- [官方 ZCode 架构](https://github.com/zai-org/ZCode/blob/aac4755666d09fdcd70272fcf063c077a639015f/docs/web-remote-control/web-remote-control-architecture.md)
- [官方 relay 认证](https://github.com/zai-org/ZCode/blob/aac4755666d09fdcd70272fcf063c077a639015f/packages/desktop/src/main/webRemoteControlRelayAuthProvider.ts)
- [官方手机重连](https://github.com/zai-org/ZCode/blob/aac4755666d09fdcd70272fcf063c077a639015f/packages/web/src/webRemoteControlTransport.ts)
- [社区 ACP 远程部署](https://github.com/william0wang/zcode-acp/blob/848c1e3a2d92ede79ae6d0bf6025fb9f9f941b05/docs/REMOTE.md)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/)
- [Tunnel 可用性](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/)

Cloudflare 资料已使用 Context7 解析官方文档库后核对。项目实现以以上固定源码提交为证据；上游更新后应重新检查。
