import contact, { type Organization, type Person } from '@hcengineering/contact'
import { getAccountClient } from '@hcengineering/contact-resources'
import core, {
  AccountRole,
  generateId,
  getCurrentAccount,
  type AccountUuid,
  type Ref,
  type Status,
  type TxOperations
} from '@hcengineering/core'
import task, { type ProjectType, type TaskType } from '@hcengineering/task'
import { EmptyMarkup } from '@hcengineering/text'
import tracker, { TimeReportDayType, type IssueStatus, type Project } from '@hcengineering/tracker'
import { uniqueProjectIdentifier } from './companyMatch'
import { persistCustomer } from './utils'

/**
 * A Won lead can create or reuse a company and one project.
 * The lead stays attached to its original customer. Nothing is deleted.
 */
export async function leadIsWon (client: TxOperations, statusId: Ref<Status> | undefined): Promise<boolean> {
  if (statusId == null) return false
  const status = await client.findOne(core.class.Status, { _id: statusId })
  if (status == null) return false
  if (status.category === task.statusCategory.Won) return true
  return status.name?.trim().toLowerCase() === 'won'
}

export async function workspaceOwnerUuids (): Promise<AccountUuid[]> {
  const members = await getAccountClient().getWorkspaceMembers()
  return members.filter((member) => member.role === AccountRole.Owner).map((member) => member.person)
}

async function projectMembers (): Promise<{ members: AccountUuid[], owners: AccountUuid[] }> {
  const owners = await workspaceOwnerUuids()
  const current = getCurrentAccount().uuid
  return {
    members: Array.from(new Set([...owners, current])),
    owners: owners.length > 0 ? owners : [current]
  }
}

export async function createProjectForCompany (
  client: TxOperations,
  companyId: Ref<Organization>,
  projectName: string,
  identifier: string
): Promise<{ id: Ref<Project>, created: boolean }> {
  const name = projectName.trim()
  if (name === '') throw new Error('Project name is required')
  const existing = await client.findAll(tracker.class.Project, { company: companyId })
  const same = existing.find((project) => project.name.trim().toLowerCase() === name.toLowerCase())
  if (same !== undefined) return { id: same._id, created: false }

  const types = client.getModel().findAllSync(task.class.ProjectType, {
    _id: tracker.ids.ClassingProjectType
  }) as ProjectType[]
  const type = types[0]
  if (type === undefined) throw new Error('Classic project type was not found')
  const taskTypes = client.getModel().findAllSync(task.class.TaskType, {
    parent: type._id,
    ofClass: tracker.class.Issue
  }) as TaskType[]
  const defaultStatus = taskTypes[0]?.statuses?.[0]
  if (defaultStatus === undefined) throw new Error('Default task state was not found')

  const taken = new Set((await client.findAll(tracker.class.Project, {})).map((project) => project.identifier))
  const nextIdentifier = uniqueProjectIdentifier(identifier || name, taken)
  const access = await projectMembers()
  const projectId = generateId<Project>()
  await client.createDoc(
    tracker.class.Project,
    core.space.Space,
    {
      name,
      description: '',
      private: false,
      members: access.members,
      owners: access.owners,
      archived: false,
      autoJoin: false,
      identifier: nextIdentifier,
      sequence: 0,
      icon: tracker.icon.Home,
      color: 1,
      defaultIssueStatus: defaultStatus as Ref<IssueStatus>,
      defaultTimeReportDay: TimeReportDayType.PreviousWorkDay,
      company: companyId,
      type: type._id
    },
    projectId
  )
  await client.createMixin(projectId, tracker.class.Project, core.space.Space, type.targetClass, {})
  return { id: projectId, created: true }
}

export async function linkPersonToCompany (
  client: TxOperations,
  person: Person,
  companyName: string,
  projectName: string,
  identifier: string,
  reuseId?: Ref<Organization>
): Promise<{ companyId: Ref<Organization>, projectId: Ref<Project>, createdCompany: boolean }> {
  if (person.promotedTo != null) {
    throw new Error('This person is already linked to a company')
  }
  let companyId = reuseId
  let createdCompany = false
  if (companyId === undefined) {
    const customerId = generateId<Organization>()
    const channels = await client.findAll(contact.class.Channel, { attachedTo: person._id })
    companyId = (await persistCustomer(client, {
      customerId,
      targetClass: contact.class.Organization,
      firstName: '',
      lastName: '',
      name: companyName.trim(),
      city: person.city ?? '',
      description: EmptyMarkup,
      channels: channels
        .filter((channel) => (channel.value ?? '').trim() !== '')
        .map((channel) => ({ provider: channel.provider, value: channel.value.trim() }))
    })) as Ref<Organization>
    createdCompany = true
  }
  const project = await createProjectForCompany(client, companyId, projectName, identifier)
  await client.updateDoc(person._class, person.space, person._id, { promotedTo: companyId })
  return { companyId, projectId: project.id, createdCompany }
}
