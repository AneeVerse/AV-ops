import tools, { toolsId } from '@hcengineering/tools'
import { mergeIds } from '@hcengineering/platform'
import type { AnyComponent } from '@hcengineering/ui'

export default mergeIds(toolsId, tools, {
  component: {
    ToolsDirectory: '' as AnyComponent,
    CreateTool: '' as AnyComponent,
    EditTool: '' as AnyComponent,
    GroupEditor: '' as AnyComponent,
    ToolViewerModal: '' as AnyComponent,
    EmbeddedToolView: '' as AnyComponent
  }
})
