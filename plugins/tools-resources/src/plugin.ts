import tools, { toolsId } from '@hcengineering/tools'
import { mergeIds } from '@hcengineering/platform'
import type { AnyComponent } from '@hcengineering/ui'

export default mergeIds(toolsId, tools, {
  component: {
    ToolsDirectory: '' as AnyComponent
  }
})
