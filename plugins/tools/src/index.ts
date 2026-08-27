import { Asset, IntlString, type Plugin, plugin } from '@hcengineering/platform'

export * from './catalog'

export const toolsId = 'tools' as Plugin

const tools = plugin(toolsId, {
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
    ConfigDescription: '' as IntlString
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
