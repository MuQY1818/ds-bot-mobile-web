import z from '@deepseek-ai/schemastery'
import {applyPhoneAccess} from './phone-access.mjs'
import {applyWebStartup} from './web-startup.mjs'

export const name='ds-bot-mobile-web'
export const inject=['connection','webServer','webApp']
export const Config=z.object({phoneUrl:z.string().default('').volatile().description('手机可访问的 HTTPS 地址；留空时读取宿主公布的 Web 地址。不会创建隧道或添加域名信任。')})
export function apply(ctx,config){applyPhoneAccess(ctx,config);applyWebStartup(ctx)}
