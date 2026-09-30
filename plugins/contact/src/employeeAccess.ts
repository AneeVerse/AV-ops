//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

import { type AttachedDoc, type Class, type Doc, type Ref } from '@hcengineering/core'

/**
 * Per-employee chrome allowlist. Off (or missing) means see everything.
 * Owner/Maintainer ignore this in the UI so they cannot lock themselves out.
 * @public
 */
export interface EmployeeAccess extends AttachedDoc {
  attachedTo: Ref<Doc>
  attachedToClass: Ref<Class<Doc>>
  limitEnabled: boolean
  apps: Array<Ref<Doc>>
  widgets: Array<Ref<Doc>>
  tools: Array<Ref<Doc>>
}

/** @public */
export function isEmployeeAccessLimited (access: EmployeeAccess | undefined, bypass: boolean): boolean {
  return !bypass && access?.limitEnabled === true
}

/** @public */
export function isAccessIdAllowed (
  access: EmployeeAccess | undefined,
  list: Array<Ref<Doc>> | undefined,
  id: Ref<Doc>,
  bypass: boolean
): boolean {
  if (!isEmployeeAccessLimited(access, bypass)) return true
  return (list ?? []).includes(id)
}
