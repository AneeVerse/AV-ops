//
// Copyright © 2026 Hardcore Engineering Inc.
//
import { AccountRole, type PersonId, type PersonUuid } from '@hcengineering/core'
import { Analytics } from '@hcengineering/analytics'
import { getAccountClient } from './utils'

export interface ProvisionContactLoginResult {
  uuid: PersonUuid
  socialId: PersonId
}

export async function provisionContactLogin (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: AccountRole = AccountRole.User
): Promise<ProvisionContactLoginResult> {
  const accountClient = getAccountClient()
  try {
    return await accountClient.provisionWorkspaceUser(email, password, firstName, lastName, role)
  } catch (err: unknown) {
    Analytics.handleError(err as Error)
    throw err
  }
}
