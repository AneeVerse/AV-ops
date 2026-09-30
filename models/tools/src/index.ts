import { type Domain, IndexKind } from '@hcengineering/core'
import { type Builder, Index, Model, Prop, TypeBoolean, TypeNumber, TypeString, UX } from '@hcengineering/model'
import core, { TDoc } from '@hcengineering/model-core'
import workbench from '@hcengineering/model-workbench'
import { toolsId, type Tool, type ToolGroup } from '@hcengineering/tools'

import tools from './plugin'

export { toolsId } from '@hcengineering/tools'
export { toolsOperation } from './migration'
export default tools

export const DOMAIN_TOOLS = 'tools' as Domain

@Model(tools.class.Tool, core.class.Doc, DOMAIN_TOOLS)
@UX(tools.string.Application)
export class TTool extends TDoc implements Tool {
  @Prop(TypeString(), tools.string.Name)
  @Index(IndexKind.FullText)
    name!: string

  @Prop(TypeString(), tools.string.Description)
  @Index(IndexKind.FullText)
    description!: string

  @Prop(TypeString(), tools.string.Url)
    href!: string

  @Prop(TypeString(), tools.string.Url)
    host!: string

  @Prop(TypeString(), tools.string.Group)
    group!: ToolGroup

  @Prop(TypeBoolean(), tools.string.Https)
    https!: boolean

  @Prop(TypeString(), tools.string.Login)
    login?: string

  @Prop(TypeString(), tools.string.Password)
    password?: string

  @Prop(TypeBoolean(), tools.string.ThisApp)
    current?: boolean

  @Prop(TypeNumber(), tools.string.Name)
    order?: number
}

export function createModel (builder: Builder): void {
  builder.createModel(TTool)

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
