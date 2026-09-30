//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

import { isAccessIdAllowed, type EmployeeAccess } from '@hcengineering/contact'
import { isOwnerOrMaintainer, type Doc, type Ref } from '@hcengineering/core'
import type { Application, Widget } from '@hcengineering/workbench'

export function bypassEmployeeAccess (): boolean {
  return isOwnerOrMaintainer()
}

export function isAllowedApplication (access: EmployeeAccess | undefined, app: Application): boolean {
  return isAccessIdAllowed(access, access?.apps, app._id, bypassEmployeeAccess())
}

export function isAllowedWidget (access: EmployeeAccess | undefined, widget: Widget): boolean {
  return isAccessIdAllowed(access, access?.widgets, widget._id, bypassEmployeeAccess())
}

export function isAllowedTool (access: EmployeeAccess | undefined, toolId: Ref<Doc>): boolean {
  return isAccessIdAllowed(access, access?.tools, toolId, bypassEmployeeAccess())
}
