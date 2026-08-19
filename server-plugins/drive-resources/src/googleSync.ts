//
// Copyright © 2026 Hardcore Engineering Inc.
//
// Background Google Drive sync for Company Drive files.
//

import contact from '@hcengineering/contact'
import core, { type Blob, type Ref } from '@hcengineering/core'
import drive, { type File, type Folder } from '@hcengineering/drive'
import { type TriggerControl } from '@hcengineering/server-core'
import tracker, { type Project } from '@hcengineering/tracker'

let googleapis: any
try {
  // Optional dependency — sync is skipped when googleapis is not installed or env is missing.
  googleapis = require('googleapis').google
} catch {
  googleapis = undefined
}

function getGoogleAuth (): any | undefined {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId === undefined || clientSecret === undefined || refreshToken === undefined || googleapis === undefined) {
    return undefined
  }
  const oauth2Client = new googleapis.auth.OAuth2(clientId, clientSecret)
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

function getRootFolderId (): string | undefined {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
}

async function ensureGoogleFolder (
  driveApi: any,
  parentId: string,
  name: string
): Promise<string> {
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await driveApi.files.list({ q, fields: 'files(id)', pageSize: 1 })
  const existing = res.data.files?.[0]?.id
  if (existing !== undefined) return existing
  const created = await driveApi.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id'
  })
  return created.data.id as string
}

async function resolveGoogleParentForFile (
  control: TriggerControl,
  file: File
): Promise<string | undefined> {
  const rootId = getRootFolderId()
  if (rootId === undefined) return undefined

  const folder = (
    await control.findAll(control.ctx, drive.class.Folder, { _id: file.parent }, { limit: 1 })
  )[0]
  if (folder === undefined) return rootId

  // Walk up to find project production/distributed folder
  const projects = await control.findAll(control.ctx, tracker.class.Project, {
    $or: [
      { productionFolder: folder._id },
      { distributedFolder: folder._id },
      { driveFolder: folder._id }
    ]
  }, { limit: 1 })
  if (projects.length === 0) return rootId

  const project = projects[0] as Project
  const auth = getGoogleAuth()
  if (auth === undefined) return undefined
  const driveApi = googleapis.drive({ version: 'v3', auth })

  let googleParent = rootId
  if (project.company !== undefined) {
    const orgs = await control.findAll(
      control.ctx,
      contact.class.Organization,
      { _id: project.company },
      { limit: 1 }
    )
    const orgName = (orgs[0] as any)?.name ?? 'Company'
    googleParent = await ensureGoogleFolder(driveApi, rootId, orgName)
  }
  const projectFolderId = await ensureGoogleFolder(driveApi, googleParent, project.name)
  if (folder.title === 'production' || folder.title === 'distributed') {
    return await ensureGoogleFolder(driveApi, projectFolderId, folder.title)
  }
  return projectFolderId
}

export async function queueGoogleDriveSync (
  control: TriggerControl,
  fileId: Ref<File>,
  file: File
): Promise<void> {
  const auth = getGoogleAuth()
  const rootId = getRootFolderId()
  if (auth === undefined || rootId === undefined) return

  try {
    const versions = await control.findAll(
      control.ctx,
      drive.class.FileVersion,
      { attachedTo: fileId },
      { limit: 1, sort: { version: -1 } }
    )
    if (versions.length === 0) return
    const version = versions[0]
    const blob = (
      await control.findAll(control.ctx, core.class.Blob, { _id: version.file as Ref<Blob> }, { limit: 1 })
    )[0]
    if (blob === undefined) return

    const chunks = await control.storageAdapter.read(control.ctx, control.workspace, version.file as string)
    const buffer = Buffer.concat(chunks)

    const driveApi = googleapis.drive({ version: 'v3', auth })
    const parentId = await resolveGoogleParentForFile(control, file)
    if (parentId === undefined) return

    const uploaded = await driveApi.files.create({
      requestBody: { name: file.title, parents: [parentId] },
      media: { mimeType: version.type, body: buffer },
      fields: 'id, webViewLink'
    })

    await control.apply(control.ctx, [
      control.txFactory.createTxMixin(fileId, drive.class.File, file.space, drive.mixin.GoogleSync, {
        googleId: uploaded.data.id,
        webViewLink: uploaded.data.webViewLink,
        syncStatus: 'synced'
      })
    ])
  } catch (err) {
    console.error('[googleSync] failed', err)
    await control.apply(control.ctx, [
      control.txFactory.createTxMixin(fileId, drive.class.File, file.space, drive.mixin.GoogleSync, {
        syncStatus: 'failed'
      })
    ]).catch(() => {})
  }
}
