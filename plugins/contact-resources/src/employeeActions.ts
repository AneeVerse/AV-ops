//
// Copyright © 2022, 2026 Hardcore Engineering Inc.
//
import { type Person } from '@hcengineering/contact'
import { AccountUuid, getCurrentAccount } from '@hcengineering/core'
import login from '@hcengineering/login'
import { getResource } from '@hcengineering/platform'
import { MessageBox, getClient } from '@hcengineering/presentation'
import { showPopup } from '@hcengineering/ui'
import contact from './plugin'

export async function kickEmployee (doc: Person): Promise<void> {
  showPopup(MessageBox, {
    label: contact.string.KickEmployee,
    message: contact.string.KickEmployeeDescr,
    action: async () => {
      const client = getClient()

      const employee = client.getHierarchy().as(doc, contact.mixin.Employee)
      await client.update(employee, { active: false })

      if (doc.personUuid != null) {
        const leaveWorkspace = await getResource(login.function.LeaveWorkspace)
        await leaveWorkspace(doc.personUuid as AccountUuid)
      }
    }
  })
}

export async function deleteEmployee (doc: Person): Promise<void> {
  const current = getCurrentAccount()
  if (doc.personUuid != null && doc.personUuid === current.uuid) {
    showPopup(MessageBox, {
      label: contact.string.DeleteEmployee,
      message: contact.string.CannotDeleteYourself,
      canSubmit: false
    })
    return
  }

  showPopup(MessageBox, {
    label: contact.string.DeleteEmployee,
    message: contact.string.DeleteEmployeeDescr,
    action: async () => {
      const client = getClient()

      if (doc.personUuid != null) {
        const leaveWorkspace = await getResource(login.function.LeaveWorkspace)
        await leaveWorkspace(doc.personUuid as AccountUuid)
      }

      await client.removeDoc(doc._class, doc.space, doc._id)
    }
  })
}
