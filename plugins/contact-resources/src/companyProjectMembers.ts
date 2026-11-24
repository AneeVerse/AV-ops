//
// Copyright © 2026 Hardcore Engineering Inc.
//
import contact, { type Organization, type Person } from '@hcengineering/contact'
import {
  type AccountUuid,
  type Class,
  type Client,
  type Ref,
  type Space
} from '@hcengineering/core'

/** Avoid a contact-resources → tracker package link; class id is stable. */
const TRACKER_PROJECT_CLASS = 'tracker:class:Project' as Ref<Class<Space & { company?: Ref<Organization> }>>

/**
 * Add an account to every Tracker project linked to the company (Organization).
 */
export async function addAccountToCompanyProjects (
  client: Client,
  companyId: Ref<Organization>,
  accountUuid: AccountUuid
): Promise<void> {
  const projects = await client.findAll(TRACKER_PROJECT_CLASS, { company: companyId } as any)
  for (const project of projects) {
    if (project.members.includes(accountUuid)) continue
    await client.update(project, { $push: { members: accountUuid } })
  }
}

/**
 * Resolve personUuid accounts for all Members of a company who have a platform login.
 */
export async function getCompanyMemberAccountUuids (
  client: Client,
  companyId: Ref<Organization>
): Promise<AccountUuid[]> {
  const members = await client.findAll(contact.class.Member, { attachedTo: companyId })
  if (members.length === 0) return []

  const personIds = members.map((m) => m.contact as Ref<Person>)
  const persons = await client.findAll(contact.class.Person, { _id: { $in: personIds } })
  const accounts: AccountUuid[] = []
  for (const person of persons) {
    if (person.personUuid != null) {
      accounts.push(person.personUuid as AccountUuid)
    }
  }
  return accounts
}

/**
 * Merge company member accounts into a project members list (deduped).
 */
export async function mergeCompanyMembersIntoProjectMembers (
  client: Client,
  companyId: Ref<Organization>,
  members: AccountUuid[]
): Promise<AccountUuid[]> {
  const companyAccounts = await getCompanyMemberAccountUuids(client, companyId)
  if (companyAccounts.length === 0) return members
  return Array.from(new Set([...members, ...companyAccounts]))
}
