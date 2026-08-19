//
// Copyright © 2026 Hardcore Engineering Inc.
//
// Company Drive: Companies space, company/project folders, chat attachment filing.
//

import attachment, { type Attachment } from '@hcengineering/attachment'
import chunter, { type ChatMessage } from '@hcengineering/chunter'
import contact, { type Organization } from '@hcengineering/contact'
import core, {
  type PersonId,
  type Ref,
  type Tx,
  type TxCreateDoc,
  generateId
} from '@hcengineering/core'
import drive, {
  COMPANIES_DRIVE_NAME,
  DISTRIBUTED_FOLDER_NAME,
  INTERNAL_FOLDER_NAME,
  PRODUCTION_FOLDER_NAME,
  type Drive,
  type File,
  type FileVersion,
  type Folder
} from '@hcengineering/drive'
import { type TriggerControl } from '@hcengineering/server-core'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

import { queueGoogleDriveSync } from './googleSync'

const COMPANIES_DRIVE_ID = 'drive:space:Companies' as Ref<Drive>
const INTERNAL_FOLDER_ID = 'drive:folder:Internal' as Ref<Folder>

export async function findCompaniesDrive (control: TriggerControl): Promise<Drive | undefined> {
  const byId = await control.findAll(control.ctx, drive.class.Drive, { _id: COMPANIES_DRIVE_ID }, { limit: 1 })
  if (byId.length > 0) return byId[0]
  const byName = await control.findAll(
    control.ctx,
    drive.class.Drive,
    { name: COMPANIES_DRIVE_NAME, archived: false },
    { limit: 1 }
  )
  return byName[0]
}

async function findChildFolder (
  control: TriggerControl,
  space: Ref<Drive>,
  parent: Ref<Folder>,
  title: string
): Promise<Folder | undefined> {
  const folders = await control.findAll(
    control.ctx,
    drive.class.Folder,
    { space, parent, title },
    { limit: 1 }
  )
  return folders[0]
}

function createFolderTx (
  control: TriggerControl,
  space: Ref<Drive>,
  parent: Ref<Folder>,
  path: Ref<Folder>[],
  title: string,
  folderId: Ref<Folder> = generateId<Folder>()
): Tx[] {
  return [
    control.txFactory.createTxCreateDoc(
      drive.class.Folder,
      space,
      { title, parent, path, space },
      folderId
    )
  ]
}

function createFileFromAttachmentTxs (
  control: TriggerControl,
  space: Ref<Drive>,
  parent: Ref<Folder>,
  path: Ref<Folder>[],
  att: Attachment
): Tx[] {
  const fileId = generateId<File>()
  const versionId = generateId<FileVersion>()
  return [
    control.txFactory.createTxCreateDoc(
      drive.class.File,
      space,
      {
        title: att.name,
        parent,
        path,
        space,
        file: versionId,
        version: 1,
        versions: 1
      },
      fileId
    ),
    control.txFactory.createTxCreateDoc(
      drive.class.FileVersion,
      space,
      {
        attachedTo: fileId,
        attachedToClass: drive.class.File,
        collection: 'versions',
        title: att.name,
        file: att.file,
        size: att.size,
        type: att.type,
        lastModified: att.lastModified,
        version: 1,
        metadata: { sourceAttachment: att._id }
      },
      versionId
    ),
    control.txFactory.createTxMixin(
      fileId,
      drive.class.File,
      space,
      drive.mixin.GoogleSync,
      { syncStatus: 'pending' }
    )
  ]
}

export async function ensureCompaniesDriveTxs (control: TriggerControl): Promise<Tx[]> {
  const existing = await findCompaniesDrive(control)
  if (existing !== undefined) {
    if (existing._id !== COMPANIES_DRIVE_ID) return []
    const internal = await control.findAll(
      control.ctx,
      drive.class.Folder,
      { _id: INTERNAL_FOLDER_ID, space: COMPANIES_DRIVE_ID },
      { limit: 1 }
    )
    if (internal.length === 0) {
      return createFolderTx(
        control,
        COMPANIES_DRIVE_ID,
        drive.ids.Root,
        [],
        INTERNAL_FOLDER_NAME,
        INTERNAL_FOLDER_ID
      )
    }
    return []
  }

  const txs: Tx[] = [
    control.txFactory.createTxCreateDoc(
      drive.class.Drive,
      core.space.Space,
      {
        name: COMPANIES_DRIVE_NAME,
        description: 'Company and project files',
        private: false,
        archived: false,
        members: [],
        owners: [],
        autoJoin: true,
        restricted: false,
        type: drive.spaceType.DefaultDrive
      },
      COMPANIES_DRIVE_ID
    ),
    ...createFolderTx(
      control,
      COMPANIES_DRIVE_ID,
      drive.ids.Root,
      [],
      INTERNAL_FOLDER_NAME,
      INTERNAL_FOLDER_ID
    )
  ]
  return txs
}

export async function ensureCompanyFolderTxs (
  control: TriggerControl,
  org: Organization
): Promise<Tx[]> {
  if (org.driveFolder !== undefined) return []
  const companiesDrive = await findCompaniesDrive(control)
  if (companiesDrive === undefined) return []

  const existing = await findChildFolder(control, companiesDrive._id, drive.ids.Root, org.name)
  if (existing !== undefined) {
    return [
      control.txFactory.createTxUpdateDoc(org._class, org.space, org._id, {
        driveFolder: existing._id
      })
    ]
  }

  const folderId = generateId<Folder>()
  return [
    ...createFolderTx(control, companiesDrive._id, drive.ids.Root, [], org.name, folderId),
    control.txFactory.createTxUpdateDoc(org._class, org.space, org._id, {
      driveFolder: folderId
    })
  ]
}

export async function ensureProjectFoldersTxs (
  control: TriggerControl,
  project: Project
): Promise<Tx[]> {
  if (
    project.driveFolder !== undefined &&
    project.productionFolder !== undefined &&
    project.distributedFolder !== undefined
  ) {
    return []
  }

  const companiesDrive = await findCompaniesDrive(control)
  if (companiesDrive === undefined) return []

  let companyFolder: Ref<Folder> | undefined = project.driveFolder
  if (project.company !== undefined) {
    const org = (
      await control.findAll(control.ctx, contact.class.Organization, { _id: project.company }, { limit: 1 })
    )[0] as Organization | undefined
    if (org !== undefined) {
      const orgTxs = await ensureCompanyFolderTxs(control, org)
      if (orgTxs.length > 0) {
        // parent trigger pass will create company folder; defer project folders
        return orgTxs
      }
      companyFolder = org.driveFolder
    }
  }

  if (companyFolder === undefined) {
    companyFolder = INTERNAL_FOLDER_ID
  }

  const txs: Tx[] = []
  let projectFolderId = project.driveFolder
  let projectFolderPath: Ref<Folder>[] = [companyFolder]

  const companyFolderDoc = await control.findAll(
    control.ctx,
    drive.class.Folder,
    { _id: companyFolder },
    { limit: 1 }
  )
  if (companyFolderDoc[0] !== undefined) {
    projectFolderPath = [companyFolder, ...companyFolderDoc[0].path]
  }

  if (projectFolderId === undefined) {
    const existingProject = await findChildFolder(
      control,
      companiesDrive._id,
      companyFolder,
      project.name
    )
    projectFolderId = existingProject?._id ?? generateId<Folder>()
    if (existingProject === undefined) {
      txs.push(
        ...createFolderTx(
          control,
          companiesDrive._id,
          companyFolder,
          projectFolderPath,
          project.name,
          projectFolderId
        )
      )
    }
  }

  const projectFolderDoc = (
    await control.findAll(control.ctx, drive.class.Folder, { _id: projectFolderId }, { limit: 1 })
  )[0]
  const underProjectPath =
    projectFolderDoc !== undefined ? [projectFolderId, ...projectFolderDoc.path] : [projectFolderId, ...projectFolderPath]

  let productionId = project.productionFolder
  let distributedId = project.distributedFolder

  if (productionId === undefined) {
    const existing = await findChildFolder(
      control,
      companiesDrive._id,
      projectFolderId,
      PRODUCTION_FOLDER_NAME
    )
    productionId = existing?._id ?? generateId<Folder>()
    if (existing === undefined) {
      txs.push(
        ...createFolderTx(
          control,
          companiesDrive._id,
          projectFolderId,
          underProjectPath,
          PRODUCTION_FOLDER_NAME,
          productionId
        )
      )
    }
  }

  if (distributedId === undefined) {
    const existing = await findChildFolder(
      control,
      companiesDrive._id,
      projectFolderId,
      DISTRIBUTED_FOLDER_NAME
    )
    distributedId = existing?._id ?? generateId<Folder>()
    if (existing === undefined) {
      txs.push(
        ...createFolderTx(
          control,
          companiesDrive._id,
          projectFolderId,
          underProjectPath,
          DISTRIBUTED_FOLDER_NAME,
          distributedId
        )
      )
    }
  }

  txs.push(
    control.txFactory.createTxUpdateDoc(project._class, core.space.Space, project._id, {
      driveFolder: projectFolderId,
      productionFolder: productionId,
      distributedFolder: distributedId
    })
  )

  return txs
}

async function isGuestUploader (control: TriggerControl, socialId: PersonId): Promise<boolean> {
  const identities = await control.findAll(
    control.ctx,
    contact.class.SocialIdentity,
    { _id: socialId as any },
    { limit: 1 }
  )
  if (identities.length === 0) return true
  const employees = await control.findAll(
    control.ctx,
    contact.mixin.Employee,
    { _id: identities[0].attachedTo as Ref<any>, active: true },
    { limit: 1 }
  )
  if (employees.length === 0) return true
  return (employees[0] as any).role === 'GUEST'
}

async function resolveProjectFromAttachment (
  control: TriggerControl,
  att: Attachment
): Promise<Project | undefined> {
  const { attachedTo, attachedToClass } = att
  if (control.hierarchy.isDerived(attachedToClass, tracker.class.Issue)) {
    const issues = await control.findAll(control.ctx, tracker.class.Issue, { _id: attachedTo as Ref<Issue> }, { limit: 1 })
    if (issues.length === 0) return undefined
    const projects = await control.findAll(
      control.ctx,
      tracker.class.Project,
      { _id: issues[0].space as Ref<Project> },
      { limit: 1 }
    )
    return projects[0]
  }

  if (attachedToClass === chunter.class.ChatMessage) {
    const messages = await control.findAll(
      control.ctx,
      chunter.class.ChatMessage,
      { _id: attachedTo as Ref<ChatMessage> },
      { limit: 1 }
    )
    if (messages.length === 0) return undefined
    const msg = messages[0]
    if (control.hierarchy.isDerived(msg.attachedToClass, tracker.class.Issue)) {
      const issues = await control.findAll(
        control.ctx,
        tracker.class.Issue,
        { _id: msg.attachedTo as Ref<Issue> },
        { limit: 1 }
      )
      if (issues.length === 0) return undefined
      const projects = await control.findAll(
        control.ctx,
        tracker.class.Project,
        { _id: issues[0].space as Ref<Project> },
        { limit: 1 }
      )
      return projects[0]
    }
    if (msg.attachedToClass === tracker.class.Project) {
      const projects = await control.findAll(
        control.ctx,
        tracker.class.Project,
        { _id: msg.attachedTo as Ref<Project> },
        { limit: 1 }
      )
      return projects[0]
    }
  }

  if (attachedToClass === tracker.class.Project) {
    const projects = await control.findAll(
      control.ctx,
      tracker.class.Project,
      { _id: attachedTo as Ref<Project> },
      { limit: 1 }
    )
    return projects[0]
  }

  return undefined
}

/** @public */
export async function OnCompanyDriveBootstrap (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const result: Tx[] = [...(await ensureCompaniesDriveTxs(control))]
  for (const tx of txes) {
    if (tx._class !== core.class.TxCreateDoc) continue
    const createTx = tx as TxCreateDoc<Organization | Project>
    if (createTx.objectClass === contact.class.Organization) {
      const org = {
        ...(createTx.object as Organization),
        _id: createTx.objectId,
        _class: contact.class.Organization,
        space: contact.space.Contacts
      }
      result.push(...(await ensureCompanyFolderTxs(control, org)))
    } else if (createTx.objectClass === tracker.class.Project) {
      const project = {
        ...(createTx.object as Project),
        _id: createTx.objectId,
        _class: tracker.class.Project,
        space: core.space.Space
      }
      result.push(...(await ensureProjectFoldersTxs(control, project)))
    }
  }
  return result
}

/** @public */
export async function OnAttachmentCreateForDrive (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const result: Tx[] = [...(await ensureCompaniesDriveTxs(control))]
  for (const tx of txes) {
    if (tx._class !== core.class.TxCreateDoc) continue
    const createTx = tx as TxCreateDoc<Attachment>
    if (createTx.objectClass !== attachment.class.Attachment) continue
    const att = createTx.object as Attachment

    const project = await resolveProjectFromAttachment(control, {
      ...att,
      _id: createTx.objectId
    } as Attachment)
    if (project === undefined) continue

    result.push(...(await ensureProjectFoldersTxs(control, project)))

    const updatedProjects = await control.findAll(
      control.ctx,
      tracker.class.Project,
      { _id: project._id },
      { limit: 1 }
    )
    const p = updatedProjects[0] ?? project
    const targetFolder = (await isGuestUploader(control, createTx.modifiedBy))
      ? p.distributedFolder
      : p.productionFolder
    if (targetFolder === undefined) continue

    const companiesDrive = await findCompaniesDrive(control)
    if (companiesDrive === undefined) continue

    const folderDoc = (
      await control.findAll(control.ctx, drive.class.Folder, { _id: targetFolder }, { limit: 1 })
    )[0]
    const path = folderDoc !== undefined ? [targetFolder, ...folderDoc.path] : [targetFolder]

    const dup = await control.findAll(
      control.ctx,
      drive.class.FileVersion,
      { file: att.file, space: companiesDrive._id },
      { limit: 1 }
    )
    if (dup.length > 0) continue

    result.push(
      ...createFileFromAttachmentTxs(
        control,
        companiesDrive._id,
        targetFolder,
        path,
        { ...att, _id: createTx.objectId } as Attachment
      )
    )
  }
  return result
}

/** @public */
export async function OnDriveFileCreatedForSync (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  for (const tx of txes) {
    if (tx._class !== core.class.TxCreateDoc) continue
    const createTx = tx as TxCreateDoc<File>
    if (createTx.objectClass !== drive.class.File) continue
    void queueGoogleDriveSync(control, createTx.objectId, createTx.object as File)
  }
  return []
}
