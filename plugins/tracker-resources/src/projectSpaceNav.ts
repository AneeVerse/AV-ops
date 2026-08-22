import { getResource } from '@hcengineering/platform'
import { Project } from '@hcengineering/tracker'
import { NavigatorModel, SpacesNavModel, SpecialNavModel } from '@hcengineering/workbench'

export const projectSpacesNavId = 'projects'

export function getProjectSpacesNavModel (model: NavigatorModel | undefined): SpacesNavModel | undefined {
  return model?.spaces?.find((sp) => sp.id === projectSpacesNavId)
}

export async function resolveProjectSpaceSpecials (
  model: SpacesNavModel | undefined,
  space: Project
): Promise<SpecialNavModel[]> {
  if (model == null) return []
  const result: SpecialNavModel[] = []
  for (const sp of model.specials ?? []) {
    let shouldAdd = true
    if (sp.visibleIf !== undefined) {
      const visibleIf = await getResource(sp.visibleIf)
      if (visibleIf !== undefined) {
        shouldAdd = await visibleIf([space])
      }
    }
    if (shouldAdd) {
      result.push(sp)
    }
  }
  return result
}
