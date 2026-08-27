import { loadMetadata } from '@hcengineering/platform'
import tools from '@hcengineering/tools'

const icons = require('../assets/icons.svg') as string // eslint-disable-line
loadMetadata(tools.icon, {
  Application: `${icons}#application`,
  Websites: `${icons}#websites`,
  Studio: `${icons}#studio`,
  Business: `${icons}#business`,
  Tools: `${icons}#tools`
})
