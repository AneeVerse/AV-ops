import { type Builder } from '@hcengineering/model'
import core from '@hcengineering/model-core'
import workbench from '@hcengineering/model-workbench'
import { toolsId } from '@hcengineering/tools'

import tools from './plugin'

export { toolsId } from '@hcengineering/tools'
export { toolsOperation } from './migration'
export default tools

export function createModel (builder: Builder): void {
  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: tools.string.Application,
      icon: tools.icon.Application,
      alias: toolsId,
      hidden: false,
      position: 'top',
      order: 250,
      component: tools.component.ToolsDirectory
    },
    tools.app.Tools
  )
}
