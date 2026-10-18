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

## 不购买域名的持久地址

Cloudflare Named Tunnel 的固定自定义主机名通常需要自己控制的域名，但“持久连接”不只这一种实现。以下方案不要求购买域名：

| 方案 | 固定地址 | 主要限制 |
| --- | --- | --- |
| 已有 Tailscale MagicDNS / Serve | 同一机器与 tailnet 保留时稳定 | 手机需连接私网；NAT 不能直连时走中继 |
| ngrok Free dev domain | 账号分配一个固定域名，重启可复用 | 每月1GB出站、2万HTTP请求，HTML首次有访问提示 |
| Cloudflare workers.dev + SQLite Durable Objects | Worker与账号子域名保留时稳定 | 需要额外实现电脑出站中继、HTTP/WS转发与恢复 |

ngrok适合短期比较。当前Web约每1.5秒轮询一次，仅连续前台轮询约8.3小时便可能用完2万次月请求，尚未计资源与其他API。一个免费dev domain还需稳定本机网关按路径分流Web与Bridge两个端口。浏览器首次提示和原生WebSocket握手应分别验收。

Cloudflare为个人项目提供免费的 `worker.account.workers.dev` 地址。Workers Free及SQLite Durable Objects各有独立额度；DO可接受电脑和手机两条出站建立的WebSocket并转发消息，使用Hibernation API减少空闲运行成本。该方案是新的中继功能，不能将workers.dev直接填为现有隧道就声称可用。需要账号、稳定host identity、relay认证、重连、流控、受控路由，以及保留现有DSH owner与Bridge设备鉴权。

固定地址不等于永不断线。电脑离线期间仍不可访问；恢复后App沿用配对的前提是Bridge home/serverId、设备凭据和HTTPS origin均保留。DSH Web宿主重启后的重新登录行为另由宿主认证决定。

官方依据：

- [ngrok免费方案限制](https://ngrok.com/docs/pricing-limits/free-plan-limits)
- [ngrok WebSocket](https://ngrok.com/docs/using-ngrok-with/websockets)
- [workers.dev地址](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Workers限制](https://developers.cloudflare.com/workers/platform/limits/)
- [Durable Objects额度](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [DO WebSocket休眠](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Tailscale连接类型](https://tailscale.com/docs/reference/connection-types)

以上资料于2026-10-18通过Context7与官方文档核对，免费方案和配额可能变化。当前版本未部署新中继服务。
