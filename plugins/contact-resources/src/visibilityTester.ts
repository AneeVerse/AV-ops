//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2022, 2026 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import contact, { type Employee, type Person } from '@hcengineering/contact'
import { AccountRole, getCurrentAccount, hasAccountRole } from '@hcengineering/core'
import { getClient } from '@hcengineering/presentation'

export async function canResendInvitation (employee: Employee): Promise<boolean> {
  const client = getClient()
  const person = client.getHierarchy().as(employee, contact.class.Person)
  if (person.personUuid != null) return false
  return !employee.active
}

export async function canSendResetLink (person: Person): Promise<boolean> {
  if (person.personUuid == null) return false
  const account = getCurrentAccount()
  if (person.personUuid === account.uuid) return false
  if (!hasAccountRole(account, AccountRole.Maintainer)) return false
  const client = getClient()
  if (client.getHierarchy().hasMixin(person, contact.mixin.Employee)) {
    const employee = client.getHierarchy().as(person, contact.mixin.Employee)
    return employee.active
  }
  return true
}

export async function canMergePersons (person: Person): Promise<boolean> {
  const client = getClient()
  const hierarchy = client.getHierarchy()

  return hierarchy.hasMixin(person, contact.mixin.Employee)
}
