import {INKS} from '../../../ds-bot-upstream/ds-bot/src/client/inks.js'

// MobileChrome renders upstream marks even when the Bot shell surface is absent.
// Keep their canonical paints and geometry local to mobile instead of mounting
// the upstream shell's global styling or duplicating its palette by hand.
const palette=index=>Object.entries(INKS).map(([name,colors])=>`--bt-ink-${name}:${colors[index]}`).join(';')
export const mascotCss=`@media(max-width:767px),(max-width:1024px) and (max-height:500px){
body[data-dsm-enabled] .bt-mark{${palette(0)};display:inline-block;flex:none;position:relative;line-height:0}
body[data-dsm-enabled][data-ds-dark-theme] .bt-mark{${palette(1)}}
body[data-dsm-enabled] .bt-mark svg{width:100%;height:100%;overflow:visible}
body[data-dsm-enabled] .bt-mark-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;box-shadow:inset 0 0 0 1px var(--dsm-line)}
body[data-dsm-enabled] .bt-mark .bt-b,body[data-dsm-enabled] .bt-mark .bt-eye,body[data-dsm-enabled] .bt-mark .bt-eyes,body[data-dsm-enabled] .bt-mark .bt-gaze{transform-box:fill-box}
body[data-dsm-enabled] .bt-mark .bt-b{transform-origin:50% 100%}
body[data-dsm-enabled] .bt-mark .bt-eye,body[data-dsm-enabled] .bt-mark .bt-eyes{transform-origin:center}
body[data-dsm-enabled] .bt-badge{position:absolute;right:0;bottom:0;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1.5px var(--bt-sidebar,#fff)}
body[data-dsm-enabled] .bt-badge-admin{background:color-mix(in srgb,var(--bt-star,#ff9800) 82%,var(--bt-sidebar,#fff))}
body[data-dsm-enabled] .bt-badge-admin svg{width:7px;height:7px}
body[data-dsm-enabled] .bt-badge-main{right:calc(var(--bt-size,36px) * -.07);bottom:calc(var(--bt-size,36px) * -.07);width:clamp(14px,calc(var(--bt-size,36px) * .36),22px);height:clamp(14px,calc(var(--bt-size,36px) * .36),22px);border-radius:0;box-shadow:none}
body[data-dsm-enabled] .bt-badge-main svg{width:100%;height:100%;overflow:visible}
body[data-dsm-enabled] .bt-badge-main path{fill:var(--bt-star,#ff9800);stroke:var(--bt-sidebar,#fff);stroke-width:2.6;stroke-linejoin:round;paint-order:stroke}
body[data-dsm-enabled] .bt-badge-alert{background:color-mix(in srgb,var(--bt-accent,#4d6bfe) 78%,var(--bt-sidebar,#fff));color:var(--bt-accent-ink,#fff);font-size:8.5px;line-height:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
body[data-dsm-enabled] .bt-badge-working{background:color-mix(in srgb,var(--bt-green,#00c972) 82%,var(--bt-sidebar,#fff));width:8px;height:8px;right:1px;bottom:1px}
body[data-dsm-enabled] .bt-cluster{position:relative;display:inline-block;flex:none;line-height:0}
body[data-dsm-enabled] .bt-cluster>*{position:absolute}
body[data-dsm-enabled] .bt-cluster-more,body[data-dsm-enabled] .bt-cluster-you{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bt-active,#8883);color:var(--dsm-secondary);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-weight:500;line-height:1;font-variant-numeric:tabular-nums}
body[data-dsm-enabled] .bt-cluster-you{background:color-mix(in srgb,var(--dsm-ink) 12%,transparent)}
body[data-dsm-enabled] .bt-stack{display:inline-flex;align-items:center;flex:none;line-height:0}
body[data-dsm-enabled] .bt-stack>*+*{margin-left:calc(var(--bt-stack-size) * -.3)}
body[data-dsm-enabled] .bt-stack-more{font-size:11px;line-height:16px;color:var(--dsm-secondary);margin-left:3px!important}
}`
