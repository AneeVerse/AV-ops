//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

import contact, { type Person } from '@hcengineering/contact'
import core, { type Client, type Ref, type Space } from '@hcengineering/core'

/**
 * Add the assignee's account to space.members if they are not already there.
 * Runs in the UI so it works against stock transactor images. Includes private
 * funnels/projects; skips system spaces.
 */
export async function ensureAssigneeJoined (
  client: Client,
  spaceId: Ref<Space> | undefined,
  assigneeRef: Ref<Person> | null | undefined
): Promise<void> {
  if (spaceId == null || assigneeRef == null) {
    return
  }
  const space = await client.findOne(core.class.Space, { _id: spaceId })
  if (space == null) {
    return
  }
  if (client.getHierarchy().isDerived(space._class, core.class.SystemSpace)) {
    return
  }
  const person = await client.findOne(contact.class.Person, { _id: assigneeRef })
  const accountUuid = person?.personUuid
  if (accountUuid == null) {
    return
  }
  if ((space.members ?? []).includes(accountUuid)) {
    return
  }
  await client.update(space, { $push: { members: accountUuid } })
}
