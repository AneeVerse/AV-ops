import type { Class, Doc, Ref } from '@hcengineering/core'
import { Asset, IntlString, type Plugin, plugin } from '@hcengineering/platform'

import type { ToolGroup } from './catalog'

export * from './catalog'

/**
 * @public
 */
export interface Tool extends Doc {
  name: string
  description: string
  href: string
  host: string
  group: ToolGroup
  https: boolean
  login?: string
  password?: string
  current?: boolean
  order?: number
}

/**
 * @public
 */
export function catalogToolId (id: string): Ref<Tool> {
  return `tools:tool:${id}` as Ref<Tool>
}

export const toolsId = 'tools' as Plugin

const tools = plugin(toolsId, {
  class: {
    Tool: '' as Ref<Class<Tool>>
  },
  string: {
    Application: '' as IntlString,
    Subtitle: '' as IntlString,
    SearchPlaceholder: '' as IntlString,
    All: '' as IntlString,
    Websites: '' as IntlString,
    Studio: '' as IntlString,
    BusinessApps: '' as IntlString,
    BotsAndTools: '' as IntlString,
    WebsitesHint: '' as IntlString,
    StudioHint: '' as IntlString,
    BusinessHint: '' as IntlString,
    ToolsHint: '' as IntlString,
    ThisApp: '' as IntlString,
    Https: '' as IntlString,
    Http: '' as IntlString,
    Empty: '' as IntlString,
    ConfigLabel: '' as IntlString,
    ConfigDescription: '' as IntlString,
    AddTool: '' as IntlString,
    EditTool: '' as IntlString,
    DeleteTool: '' as IntlString,
    Name: '' as IntlString,
    Url: '' as IntlString,
    Description: '' as IntlString,
    Group: '' as IntlString,
    Login: '' as IntlString,
    Password: '' as IntlString,
    Copy: '' as IntlString,
    Copied: '' as IntlString,
    ShowPassword: '' as IntlString,
    HidePassword: '' as IntlString,
    NoCredentials: '' as IntlString,
    SaveTool: '' as IntlString,
    ToolNamePlaceholder: '' as IntlString,
    UrlPlaceholder: '' as IntlString,
    LoginPlaceholder: '' as IntlString,
    PasswordPlaceholder: '' as IntlString,
    DeleteToolConfirm: '' as IntlString
  },
  icon: {
    Application: '' as Asset,
    Websites: '' as Asset,
    Studio: '' as Asset,
    Business: '' as Asset,
    Tools: '' as Asset
  }
})

export default tools
