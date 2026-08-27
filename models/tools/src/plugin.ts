import { toolsId } from '@hcengineering/tools'
import tools from '@hcengineering/tools-resources/src/plugin'
import { type Ref } from '@hcengineering/core'
import { type Application } from '@hcengineering/model-workbench'
import { mergeIds } from '@hcengineering/platform'

export default mergeIds(toolsId, tools, {
  app: {
    Tools: '' as Ref<Application>
  }
})
