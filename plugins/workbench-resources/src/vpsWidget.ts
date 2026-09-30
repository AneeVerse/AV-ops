//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

import core from '@hcengineering/core'
import { WidgetType, type Widget } from '@hcengineering/workbench'

import workbench from './plugin'

/** Frontend-only Fixed widget — not stored in model_tx. */
export const vpsWidget: Widget = {
  _id: workbench.ids.VpsFoldersWidget,
  _class: workbench.class.Widget,
  space: core.space.Model,
  modifiedBy: core.account.System,
  modifiedOn: 0,
  label: workbench.string.Vps,
  icon: workbench.icon.Vps,
  type: WidgetType.Fixed,
  component: workbench.component.VpsExplorer
}
